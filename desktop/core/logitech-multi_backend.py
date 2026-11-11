# SPDX-License-Identifier: GPL-2.0-or-later
# HID++ layouts adapted from pwr-Solaar/Solaar, commit
# e7304c4c451cc9bb4f206a914844525e67856a28. See research/LOGITECH-HIDPP.md.
"""Per-instance HID++ 2 mouse control, with runtime feature/readback gating.

No daemon, receiver pairing, firmware update, or onboard profile flash writes.
HID output reports used during scan/status contain read requests only.
"""
import argparse
import hashlib
import json
import math
import re
import secrets
import struct
import sys
import time
from pathlib import Path

RATES = {0: 125, 1: 250, 2: 500, 3: 1000, 4: 2000, 5: 4000, 6: 8000}
# Explicit HID++ receivers from Solaar base_usb.py, not a VID-wide allowlist.
RECEIVERS = {0xc539: 6, 0xc53a: 6, 0xc53d: 6, 0xc53f: 6, 0xc541: 6,
             0xc545: 6, 0xc547: 2, 0xc54d: 6, 0xc52b: 6, 0xc532: 6,
             0xc548: 6, 0xc537: 2}


def parse_dpis(data):
    result, offset = [], 0
    while offset + 2 <= len(data):
        value = int.from_bytes(data[offset:offset + 2], 'big')
        offset += 2
        if not value:
            if not result:
                raise ValueError('Empty DPI list')
            return result
        if value >> 13 == 7:
            if offset + 2 > len(data):
                raise ValueError('Truncated DPI range')
            step = value & 0x1fff
            end = int.from_bytes(data[offset:offset + 2], 'big')
            offset += 2
            if not result or not step or end <= result[-1]:
                raise ValueError('Invalid DPI range')
            result.extend(range(result[-1] + step, end + 1, step))
        else:
            result.append(value)
        if len(result) > 65536:
            raise ValueError('DPI list too large')
    raise ValueError('Unterminated DPI list')


class Link:
    def __init__(self, handle, slot, timeout=0.65):
        self.handle, self.slot, self.timeout = handle, slot, timeout
        self.software_id = secrets.randbelow(15) + 1
        self.features = {}

    def request(self, index, function, params=b'', timeout=None):
        if len(params) > 16:
            raise ValueError('HID++ request too long')
        # A late root.GetFeature response has the same index/function as the next
        # feature lookup. Rotate transaction IDs and drain pending reports before
        # sending, or a timeout could cache the wrong feature's writable index.
        self.software_id = self.software_id % 15 + 1
        for _ in range(64):
            if not self.handle.read(64, 1):
                break
        function = (function & 0xf0) | self.software_id
        packet = bytes([0x11, self.slot, index, function]) + params.ljust(16, b'\0')
        if self.handle.write(packet) != len(packet):
            raise OSError('HID++ write incomplete')
        end = time.monotonic() + (self.timeout if timeout is None else timeout)
        while time.monotonic() < end:
            reply = bytes(self.handle.read(64, max(1, int((end - time.monotonic()) * 1000))))
            if len(reply) < 4 or reply[0] not in (0x10, 0x11):
                continue
            # Only direct Bluetooth devices may answer FF-addressed requests as 00.
            if reply[1] != self.slot and not (self.slot == 0xff and reply[1] == 0):
                continue
            if reply[2] in (0xff, 0x8f) and len(reply) >= 6 and reply[3:5] == bytes([index, function]):
                raise OSError('HID++ rejected request: %02x' % reply[5])
            if reply[2:4] == bytes([index, function]):
                return reply[4:]
        raise TimeoutError('设备没有响应，请唤醒鼠标并关闭正在占用设备的设置程序')

    def feature(self, feature):
        if feature not in self.features:
            reply = self.request(0, 0, feature.to_bytes(2, 'big'))
            if len(reply) < 3:
                raise ValueError('Feature descriptor incomplete')
            self.features[feature] = reply[0]
        return self.features[feature]

    def call(self, feature, function=0, params=b''):
        index = self.feature(feature)
        if not index:
            raise ValueError('Feature %04x unavailable' % feature)
        return self.request(index, function, params)

    def identify(self):
        nonce = secrets.token_bytes(1)
        reply = self.request(0, 0x10, b'\0\0' + nonce, timeout=0.2)
        if len(reply) < 3 or reply[0] < 2 or reply[2:3] != nonce:
            raise ValueError('HID++ 2 identity handshake failed')
        identity = {'protocol': '%d.%d' % (reply[0], reply[1]), 'ids': [], 'unit': '', 'name': None}
        if self.feature(0x0003):
            ids = self.call(0x0003)
            if len(ids) < 13:
                raise ValueError('Device identity incomplete')
            identity['unit'] = ids[1:5].hex()
            offset = 7
            for flag in (1, 2, 4, 8):
                if ids[6] & flag:
                    if offset + 2 > 13:
                        raise ValueError('Invalid transport ID list')
                    identity['ids'].append(int.from_bytes(ids[offset:offset + 2], 'big'))
                    offset += 2
        if self.feature(0x0005):
            length = self.call(0x0005)[0]
            if not 1 <= length <= 80:
                raise ValueError('Unexpected device name length')
            name = b''
            while len(name) < length:
                fragment = self.call(0x0005, 0x10, bytes([len(name)]))
                if not fragment:
                    raise ValueError('Incomplete device name')
                name += fragment
            identity['name'] = name[:length].decode('utf-8', errors='replace')
            identity['kind'] = self.call(0x0005, 0x20)[0]
        return identity


def load_models():
    return json.loads((Path(__file__).parent.parent / 'catalog/logitech-hidpp.json').read_text(encoding='utf8'))['models']


def match_model(models, info, identity):
    ids = set(identity['ids'])
    if info['product_id'] not in RECEIVERS:
        ids.add(info['product_id'])
    matches = [model for model in models if ids.intersection(item['productId'] for item in model['identifiers'])]
    # A receiver's PID is never a model identity. Name-only/VID-only matches do not enable writes.
    if len(matches) != 1 or identity.get('kind', 3) != 3:
        return None
    return matches[0]


def control_id(info, slot, identity):
    raw = info['path']
    if isinstance(raw, bytes):
        raw = raw.decode('utf8', errors='surrogateescape')
    value = raw.lower() + '|' + str(slot) + '|' + identity.get('unit', '')
    digest = hashlib.sha256(value.encode('utf8', errors='surrogateescape')).hexdigest()[:20]
    return 'logitech-046d-%04x-%s' % (info['product_id'], digest)


def public_identity(model, info, slot, identity):
    return {'id': control_id(info, slot, identity), 'modelId': model['id'], 'name': model['name'],
            'brand': 'logitech', 'kind': model['kind'], 'vendorId': 0x046d, 'productId': info['product_id'],
            'interface': info.get('interface_number'), 'slot': slot, 'connected': True,
            'protocol': identity['protocol'], 'verification': 'unverified',
            'transport': 'lightspeed' if info['product_id'] in RECEIVERS else
                         ('bluetooth' if info['product_id'] & 0xf000 == 0xb000 else 'usb')}


class Mouse:
    def __init__(self, link, device):
        self.link, self.device = link, device

    def mode(self):
        if not self.link.feature(0x8100):
            return None
        mode = self.link.call(0x8100, 0x20)[0]
        if mode not in (1, 2):
            raise ValueError('Invalid onboard profile mode')
        return mode

    def dpi_choices(self, feature, axis=0):
        choices = b''
        for page in range(32):
            response = self.link.call(feature, 0x20 if feature == 0x2202 else 0x10, bytes([0, axis, page]))
            skip = 3 if feature == 0x2202 else 1
            if len(response) <= skip + 1 or response[0] != 0:
                raise ValueError('DPI descriptor incomplete')
            choices += response[skip:]
            if choices[-2:] == b'\0\0':
                return parse_dpis(choices)
        raise ValueError('DPI descriptor is too long')

    def dpi_info(self):
        feature = 0x2202 if self.link.feature(0x2202) else 0x2201
        if not self.link.feature(feature):
            raise ValueError('DPI feature unavailable')
        has_y, has_lod = False, False
        if feature == 0x2202:
            desc = self.link.call(feature, 0x10, b'\0')
            if len(desc) < 3:
                raise ValueError('DPI descriptor incomplete')
            has_y, has_lod = bool(desc[2] & 1), bool(desc[2] & 2)
        choices = self.dpi_choices(feature)
        y_choices = self.dpi_choices(feature, 1) if has_y else choices
        data = self.link.call(feature, 0x50 if feature == 0x2202 else 0x20, b'\0')
        if len(data) < (10 if feature == 0x2202 else 5) or data[0] != 0:
            raise ValueError('DPI state incomplete')
        x = int.from_bytes(data[1:3], 'big') or int.from_bytes(data[3:5], 'big')
        y = (int.from_bytes(data[5:7], 'big') or int.from_bytes(data[7:9], 'big')) if has_y else x
        if x not in choices or y not in y_choices:
            raise ValueError('Device DPI is outside its declared choices')
        return {'feature': feature, 'x': x, 'y': y, 'choices': choices, 'yChoices': y_choices,
                'hasY': has_y, 'hasLod': has_lod, 'lod': data[9] if has_lod else 0}

    def rate_info(self):
        if self.link.feature(0x8061):
            flags = int.from_bytes(self.link.call(0x8061, 0x10)[:2], 'big')
            choices = {rate: bit for bit, rate in RATES.items() if flags & (1 << bit)}
            current = RATES.get(self.link.call(0x8061, 0x20)[0])
            feature = 0x8061
        else:
            flags = self.link.call(0x8060)[0]
            # 3/6/7 ms are not integer Hz; preserve wire intervals in the map.
            choices = {round(1000 / interval, 3): interval for interval in range(1, 9) if flags & (1 << (interval - 1))}
            interval = self.link.call(0x8060, 0x10)[0]
            if not interval:
                raise ValueError('Invalid report interval')
            current, feature = round(1000 / interval, 3), 0x8060
        if self.device['modelId'] == 'logitech-g309':
            choices = {hz: code for hz, code in choices.items() if hz <= 1000}
        if current not in choices:
            raise ValueError('Device rate is outside its declared choices')
        return {'feature': feature, 'choices': choices, 'current': current}

    def brightness_info(self):
        data = self.link.call(0x8040)
        if len(data) < 6:
            raise ValueError('Brightness descriptor incomplete')
        maximum, minimum = int.from_bytes(data[:2], 'big'), int.from_bytes(data[4:6], 'big')
        on_off, steps = bool(data[3] & 4), data[2] & 15
        if not 0 < maximum <= 65535 or not 0 <= minimum <= maximum:
            raise ValueError('Invalid brightness range')
        enabled = bool(self.link.call(0x8040, 0x30)[0] & 1) if on_off else True
        current = int.from_bytes(self.link.call(0x8040, 0x10)[:2], 'big') if enabled else 0
        if current > maximum:
            raise ValueError('Invalid brightness state')
        return {'max': maximum, 'min': minimum, 'onOff': on_off, 'steps': steps, 'current': current,
                'percent': round(current * 100 / maximum)}

    def status(self):
        values, caps, errors = {}, {}, {}
        mode, mode_known = None, False
        try:
            mode = self.mode()
            mode_known = True
            if mode is not None:
                values['onboardMode'] = 'host' if mode == 2 else 'onboard'
                caps['hostMode'] = {'readable': True, 'writable': True}
        except Exception as error:
            errors['hostMode'] = str(error)
        can_write = mode_known and mode in (None, 2)
        def read(name, fn):
            try:
                fn()
            except Exception as error:
                errors[name] = str(error)
        def dpi():
            if not (self.link.feature(0x2202) or self.link.feature(0x2201)):
                return
            data = self.dpi_info()
            choices = sorted(set(data['choices']))
            step = math.gcd(*(b - a for a, b in zip(choices, choices[1:]))) if len(choices) > 1 else 1
            caps['dpi'] = {'readable': True, 'writable': can_write, 'min': min(choices), 'max': max(choices),
                           'step': step, 'options': choices, 'separateAxes': data['hasY']}
            if data['hasY']:
                y_choices = sorted(set(data['yChoices']))
                y_step = math.gcd(*(b - a for a, b in zip(y_choices, y_choices[1:]))) if len(y_choices) > 1 else 1
                caps['dpi']['y'] = {'min': min(y_choices), 'max': max(y_choices), 'step': y_step, 'options': y_choices}
            values['dpi'] = [data['x'], data['y']]
        def rate():
            if not (self.link.feature(0x8061) or self.link.feature(0x8060)):
                return
            data = self.rate_info()
            caps['pollRate'] = {'readable': True, 'writable': can_write and self.device['transport'] != 'bluetooth',
                                'options': sorted(data['choices'])}
            values['pollRate'] = data['current']
        def battery():
            if self.link.feature(0x1004):
                data = self.link.call(0x1004, 0x10)
                percent, coarse, status = data[:3]
                percent = percent if percent or not coarse else None
                values['batteryLevel'] = coarse
            elif self.link.feature(0x1000):
                data = self.link.call(0x1000)
                percent, _, status = data[:3]
                percent = None if percent == 255 else percent
            else:
                return
            if percent is not None and not 0 <= percent <= 100:
                raise ValueError('Invalid battery level')
            values.update(battery=percent, batteryStatus=status, charging=status in (1, 2))
            caps['battery'] = {'readable': True, 'writable': False}
        def brightness():
            if not self.link.feature(0x8040):
                return
            data = self.brightness_info()
            caps['lighting'] = {'zones': {'all': {'brightness': {'readable': True, 'writable': can_write,
                                        'min': 0 if data['onOff'] else math.ceil(data['min'] * 100 / data['max']),
                                        'max': 100, 'step': 1}}}}
            values['brightness'] = {'all': data['percent']}
        for key, fn in [('dpi', dpi), ('pollRate', rate), ('battery', battery), ('brightness', brightness)]:
            read(key, fn)
        return {'ok': True, 'device': self.device, 'connected': True, 'interfaceConfirmed': True,
                'provider': 'logitech-hidpp2', 'capabilities': caps, 'values': values,
                'errors': errors, 'verification': 'unverified', 'sampledAt': int(time.time() * 1000)}

    def execute(self, command, value):
        if command == 'hostMode.set':
            if type(value) is not bool or not self.link.feature(0x8100):
                raise ValueError('软件控制模式需要布尔值和设备支持')
            requested = 2 if value else 1
            self.link.call(0x8100, 0x10, bytes([requested]))
            if self.mode() != requested:
                raise OSError('设备未确认控制模式切换')
            return self.status()
        current = self.status()
        cap = {'dpi.set': 'dpi', 'pollRate.set': 'pollRate', 'brightness.set': 'lighting'}.get(command)
        if cap is None:
            raise ValueError('未开放的罗技设备操作')
        if cap != 'lighting' and not current['capabilities'].get(cap, {}).get('writable'):
            raise ValueError('此接口当前不可写；板载模式设备需先开启软件控制')
        if command == 'dpi.set':
            data = self.dpi_info()
            if type(value) is int:
                x, y = value, data['y'] if data['hasY'] else value
            elif isinstance(value, list) and len(value) == 2 and all(type(n) is int for n in value):
                x, y = value
            else:
                raise ValueError('DPI 需要整数或 X/Y 整数数组')
            if x not in data['choices'] or y not in data['yChoices'] or (not data['hasY'] and x != y):
                raise ValueError('DPI 不在设备上报的支持范围内')
            payload = b'\0' + struct.pack('!H', x)
            if data['feature'] == 0x2202:
                payload += struct.pack('!HB', y if data['hasY'] else 0, data['lod'])
            self.link.call(data['feature'], 0x60 if data['feature'] == 0x2202 else 0x30, payload)
            result = self.dpi_info()
            if (result['x'], result['y']) != (x, y):
                raise OSError('DPI 回读与设定值不一致')
        elif command == 'pollRate.set':
            data = self.rate_info()
            if type(value) not in (int, float) or value not in data['choices']:
                raise ValueError('回报率不在设备上报的支持范围内')
            self.link.call(data['feature'], 0x30 if data['feature'] == 0x8061 else 0x20, bytes([data['choices'][value]]))
            if self.rate_info()['current'] != value:
                raise OSError('回报率回读与设定值不一致')
        else:
            zones = current['capabilities'].get('lighting', {}).get('zones', {})
            if not isinstance(value, dict) or value.get('zone') != 'all' or not zones.get('all', {}).get('brightness', {}).get('writable'):
                raise ValueError('此灯区当前不可写')
            percent = value.get('percent')
            if type(percent) not in (int, float) or not 0 <= percent <= 100:
                raise ValueError('亮度需要 0–100 的数值')
            data = self.brightness_info()
            raw = round(percent * data['max'] / 100)
            if raw and raw < data['min']:
                raise ValueError('亮度低于设备支持的最小值')
            if data['steps'] >= 2 and raw:
                marks = [math.ceil(data['max'] / (2 ** i)) for i in range(data['steps'] - 1)]
                valid_marks = [m for m in marks if m >= data['min']]
                raw = min(valid_marks, key=lambda m: abs(m - raw))
            if data['onOff']:
                self.link.call(0x8040, 0x40, bytes([1 if raw else 0]))
            elif raw < data['min']:
                raise ValueError('设备不支持关闭亮度')
            if raw or not data['onOff']:
                self.link.call(0x8040, 0x20, raw.to_bytes(2, 'big'))
            if self.brightness_info()['current'] != raw:
                raise OSError('亮度回读与设定值不一致')
        return self.status()


def candidates(hid, models):
    allowed = {item['productId'] for model in models for item in model['identifiers']}
    groups = {}
    for info in hid.enumerate(0x046d, 0):
        if info['product_id'] not in allowed and info['product_id'] not in RECEIVERS:
            continue
        if info.get('usage_page') != 0xff00 or info.get('usage') not in (1, 2):
            continue
        raw = info['path'].decode('utf8', errors='replace') if isinstance(info['path'], bytes) else info['path']
        key = re.sub(r'&col[0-9a-f]{2}', '', raw.lower())
        # Long HID++ collection is the preferred route; retain separate physical instances.
        if key not in groups or info.get('usage') == 2:
            groups[key] = info
    return list(groups.values())


def discover(hid, models, target=None):
    """Yield an open, freshly identified endpoint. Caller closes via generator.close()."""
    for info in candidates(hid, models):
        handle = hid.device()
        try:
            handle.open_path(info['path'])
            slots = range(1, RECEIVERS[info['product_id']] + 1) if info['product_id'] in RECEIVERS else (0xff,)
            for slot in slots:
                try:
                    link = Link(handle, slot)
                    identity = link.identify()
                    model = match_model(models, info, identity)
                    if not model:
                        continue
                    device = public_identity(model, info, slot, identity)
                    if target is None or device['id'] == target:
                        yield Mouse(link, device)
                except (OSError, ValueError, IndexError, TimeoutError):
                    continue
        except OSError:
            continue
        finally:
            handle.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--payload', required=True)
    parser.add_argument('--state', required=True)
    parser.add_argument('--resources')
    args = parser.parse_args()
    sys.path.insert(0, str(Path(args.payload) / 'g309-deps'))
    import hid
    request = json.load(sys.stdin)
    if request.get('action') not in ('scan', 'status', 'execute'):
        raise ValueError('Unsupported action')
    devices = discover(hid, load_models(), request.get('deviceId'))
    try:
        if request['action'] == 'scan':
            return {'ok': True, 'devices': [mouse.device for mouse in devices]}
        if not re.fullmatch(r'logitech-046d-[a-f0-9]{4}-[a-f0-9]{20}', request.get('deviceId', '')):
            raise ValueError('Actual connected device ID is required')
        mouse = next(devices, None)
        if mouse is None:
            raise OSError('这台罗技设备已断开或尚未唤醒')
        return mouse.status() if request['action'] == 'status' else mouse.execute(request.get('command'), request.get('value'))
    finally:
        devices.close()


if __name__ == '__main__':
    try:
        print(json.dumps(main(), ensure_ascii=True))
    except Exception as error:
        print(json.dumps({'ok': False, 'error': str(error)}, ensure_ascii=True))

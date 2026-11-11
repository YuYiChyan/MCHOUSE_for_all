"""Multi-model bridge over the existing openrazer-win recipes, never a new protocol.

JSON stdin requests: {action:'scan'|'status'|'execute'|'catalog', deviceId?, command?, value?}.
Enumeration identifies each actual control-interface path independently.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path


def setup(payload_root):
    package = Path(payload_root) / 'openrazer-win'
    if not (package / 'openrazer_win' / 'devices' / 'data' / 'devices.json').is_file():
        raise RuntimeError('本机缺少 openrazer-win 设备模块')
    sys.path.insert(0, str(package))
    return package


def metadata_device(meta, recipes):
    from openrazer_win.core.device import RazerDevice
    # Capability computation consults metadata and recipes without opening a device.
    class TransportStub:
        class Info:
            path = ''
            interface = None
        info = Info()
        wait = 0
    return RazerDevice(meta, TransportStub(), recipes=recipes)


def declared_capabilities(device):
    caps = device.capabilities()
    has = lambda attr, *methods: device._feature(attr, *methods)
    result = {
        'dpi': {'readable': caps['dpi'], 'writable': has('write:dpi', 'set_dpi_xy', 'set_dpi_xy_byte') and bool(device.info.dpi_max), 'min': 100, 'max': device.info.dpi_max, 'step': 100 if device.uses_byte_dpi else 1},
        'pollRate': {'readable': caps['poll_rate'], 'writable': has('write:poll_rate', 'set_poll_rate'), 'options': caps['supported_poll_rates']},
        'dpiStages': {'readable': caps['dpi_stages'], 'writable': has('write:dpi_stages', 'set_dpi_stages')},
        'battery': {'readable': caps['battery'], 'writable': False},
        'idleTime': {'readable': caps['idle_time'], 'writable': has('write:device_idle_time', 'set_idle_time'), 'min': 60, 'max': 900, 'step': 1},
    }
    zones = {}
    for zone, value in caps['zones'].items():
        readable = False
        try:
            device._brightness_attribute(zone, write=False)
            readable = True
        except Exception:
            pass
        zones[zone] = {'effects': value['effects'], 'brightness': {'readable': readable, 'writable': bool(value['brightness']) and readable, 'min': 0, 'max': 100, 'step': 1}}
    result['lighting'] = {'zones': zones}
    return result


def catalog(package):
    from openrazer_win.devices.database import get_database
    from openrazer_win.devices.recipes import get_recipes
    from openrazer_win._version import __version__, UPSTREAM_VERSION
    recipes = get_recipes()
    source = {'provider': 'openrazer-win', 'version': __version__, 'upstreamVersion': UPSTREAM_VERSION,
              'databaseSha256': hashlib.sha256((package / 'openrazer_win/devices/data/devices.json').read_bytes()).hexdigest(),
              'recipesSha256': hashlib.sha256((package / 'openrazer_win/devices/data/recipes.json').read_bytes()).hexdigest()}
    models = []
    for meta in get_database().by_type('mouse'):
        if meta.transport != 'hid':
            continue
        capabilities = declared_capabilities(metadata_device(meta, recipes))
        models.append({'id': 'razer-%04x-%04x' % (meta.vid, meta.pid), 'brand': 'razer', 'name': meta.name, 'kind': 'mouse',
                       'identifiers': [{'vendorId': meta.vid, 'productId': meta.pid}], 'variants': [],
                       'imageUrl': meta.image, 'source': source,
                       'support': {'status': 'unverified', 'provider': 'openrazer-win', 'basis': 'device class declarations intersected with executable model recipes', 'capabilities': capabilities}})
    return {'schema': 1, 'brand': 'razer', 'source': source, 'models': models}


def control_id(info):
    digest = hashlib.sha256(info.path.lower().encode('utf8')).hexdigest()[:20]
    return 'razer-%04x-%04x-%s' % (info.vendor_id, info.product_id, digest)


def enumerate_controls(backend, database, recipes):
    by_pid = {}
    for info in backend.enumerate(vendor_id=0x1532):
        meta = database.get(info.vendor_id, info.product_id)
        if meta and meta.type == 'mouse' and meta.transport == 'hid' and info.feature_length == 91:
            by_pid.setdefault(info.product_id, []).append(info)
    controls = []
    for pid, infos in by_pid.items():
        meta = database.get(0x1532, pid)
        index = recipes.transport_params('mouse', pid).get('index')
        # Keep separate physical paths: upstream DeviceManager groups only by PID.
        # Prefer the declared interface but never merge two same-model devices.
        preferred = [info for info in infos if info.interface == index]
        controls.extend((meta, info) for info in (preferred or infos))
    return controls


def public_identity(meta, info):
    return {'id': control_id(info), 'modelId': 'razer-%04x-%04x' % (meta.vid, meta.pid),
            'name': meta.name, 'brand': 'razer', 'kind': 'mouse', 'vendorId': meta.vid, 'productId': meta.pid,
            'interface': info.interface, 'connected': True, 'imageUrl': meta.image,
            'verification': 'unverified'}


def status(device, info):
    declared = declared_capabilities(device)
    values, errors, active = {}, {}, {}
    def read_stages():
        current, stages = device.get_dpi_stages()
        return {'active': current, 'stages': [list(pair) for pair in stages]}
    readers = {'dpi': lambda: list(device.get_dpi()), 'pollRate': device.get_poll_rate,
               'dpiStages': read_stages,
               'battery': device.get_battery_level, 'idleTime': device.get_idle_time}
    for key, read in readers.items():
        descriptor = declared[key]
        if not descriptor['readable']:
            continue
        try:
            values[key] = read()
            active[key] = descriptor
        except Exception as error:
            errors[key] = str(error)
    if 'battery' in values:
        try:
            values['charging'] = device.is_charging()
        except Exception as error:
            errors['charging'] = str(error)
    zones = {}
    brightness = {}
    for zone, desc in declared['lighting']['zones'].items():
        if not desc['brightness']['readable']:
            continue
        try:
            brightness[zone] = device.get_brightness(zone)
            zones[zone] = {'brightness': desc['brightness']}
        except Exception as error:
            errors['brightness.' + zone] = str(error)
    if zones:
        active['lighting'] = {'zones': zones}
        values['brightness'] = brightness
    return {'ok': True, 'device': public_identity(device.info, info), 'connected': True,
            'interfaceConfirmed': bool(active), 'provider': 'openrazer-win',
            'capabilities': active, 'declaredCapabilities': declared, 'values': values, 'errors': errors,
            'verification': 'unverified'}


def integer(value, minimum, maximum):
    if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
        raise ValueError('数值不在该型号支持范围内')
    return value


def execute(device, info, command, value):
    before = status(device, info)
    caps = before['capabilities']
    def writable(name):
        cap = caps.get(name)
        if not cap or not cap.get('writable'):
            raise ValueError('该接口尚未得到可读取、可写入的设备响应')
        return cap
    if command == 'dpi.set':
        cap = writable('dpi')
        values = value if isinstance(value, list) else [value, value]
        if len(values) != 2:
            raise ValueError('DPI 必须包含 X/Y 两个值')
        x, y = [integer(v, cap['min'], cap['max']) for v in values]
        if any(v % cap['step'] for v in (x, y)):
            raise ValueError('DPI 不符合该型号的步进')
        device.set_dpi(x, y)
        actual = list(device.get_dpi())
        confirmed = actual == [x, y]
    elif command == 'pollRate.set':
        cap = writable('pollRate')
        if isinstance(value, bool) or value not in cap['options']:
            raise ValueError('该型号不支持此回报率')
        device.set_poll_rate(value)
        actual = device.get_poll_rate()
        confirmed = actual == value
    elif command == 'dpiStage.set':
        writable('dpiStages')
        current, stages = device.get_dpi_stages()
        index = integer(value, 1, len(stages))
        device.set_dpi_stages(index, stages)
        if caps.get('dpi', {}).get('writable'):
            device.set_dpi(*stages[index - 1])
        actual = device.get_dpi_stages()[0]
        confirmed = actual == index
    elif command == 'idleTime.set':
        cap = writable('idleTime')
        value = integer(value, cap['min'], cap['max'])
        device.set_idle_time(value)
        actual = device.get_idle_time()
        confirmed = actual == value
    elif command == 'brightness.set':
        if not isinstance(value, dict):
            raise ValueError('缺少灯区和亮度')
        zone = value.get('zone')
        cap = caps.get('lighting', {}).get('zones', {}).get(zone, {}).get('brightness', {})
        if not cap.get('writable'):
            raise ValueError('灯区不支持亮度读回')
        percent = integer(value.get('percent'), 0, 100)
        device.set_brightness(percent, zone)
        actual = device.get_brightness(zone)
        confirmed = abs(actual - percent) <= 0.5
    else:
        raise ValueError('未开放的鼠标操作')
    after = status(device, info)
    after.update({'ok': confirmed, 'command': command, 'requested': value, 'actual': actual})
    if not confirmed:
        after['error'] = '设备回读与请求值不同'
    return after


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--payload', required=True)
    parser.add_argument('--state', required=True)
    args = parser.parse_args()
    device = None
    try:
        package = setup(args.payload)
        request = json.loads(sys.stdin.read())
        if request.get('action') == 'catalog':
            print(json.dumps(catalog(package), ensure_ascii=False))
            return
        from openrazer_win.hid import get_backend
        from openrazer_win.devices.database import get_database
        from openrazer_win.devices.recipes import get_recipes
        from openrazer_win.core.device import RazerDevice
        from openrazer_win.core.transport import Transport
        from openrazer_win.core.persistence import Persistence
        backend, database, recipes = get_backend(), get_database(), get_recipes()
        controls = enumerate_controls(backend, database, recipes)
        if request.get('action') == 'scan':
            result = {'ok': True, 'devices': [public_identity(meta, info) for meta, info in controls]}
        else:
            matches = [(meta, info) for meta, info in controls if control_id(info) == request.get('deviceId')]
            if len(matches) != 1:
                raise RuntimeError('设备已断开或控制接口已改变，请重新检测')
            meta, info = matches[0]
            params = recipes.transport_params('mouse', meta.pid)
            state_path = Path(args.state) / 'razer-multi-state.json'
            state_path.parent.mkdir(parents=True, exist_ok=True)
            persistence = Persistence(str(state_path))
            device = RazerDevice(meta, Transport(backend, info, wait_us=params.get('wait_us', 600)), persistence, recipes)
            if request.get('action') == 'status':
                result = status(device, info)
            elif request.get('action') == 'execute':
                result = execute(device, info, request.get('command'), request.get('value'))
                persistence.save()
            else:
                raise ValueError('未知请求')
        print(json.dumps(result, ensure_ascii=False))
    except Exception as error:
        print(json.dumps({'ok': False, 'error': str(error)}, ensure_ascii=False))
    finally:
        if device:
            device.close()


if __name__ == '__main__':
    main()

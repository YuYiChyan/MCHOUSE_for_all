# SPDX-License-Identifier: MIT
"""Core Audio endpoints belonging to catalogued XIBERIA headphones. No device-default fallback or private HID."""
import ctypes
from ctypes import wintypes
import json
import math
import os
from pathlib import Path
import re
import sys
import time
import uuid

CATALOG = json.loads((Path(__file__).with_name('catalog.json')).read_text(encoding='utf-8'))
MODELS = {model['id']: model for model in CATALOG}

def normalize_name(value):
    return re.sub(r'[^\w\u4e00-\u9fff]', '', value.casefold()).replace('_', '')

def matches_model(model_id, usb_id, name):
    candidates = [model for model in CATALOG if usb_id in model['usbIds']]
    if len(candidates) == 1:
        model=candidates[0]
        if model.get('requireBrandName') and not any(normalize_name(alias) in normalize_name(name) for alias in model['aliases']):
            return False
        return model['id'] == model_id
    normalized = normalize_name(name)
    scores = {}
    for model in candidates:
        lengths = [len(normalize_name(alias)) for alias in model['aliases'] if normalize_name(alias) in normalized]
        scores[model['id']] = max(lengths, default=0)
    best = max(scores.values(), default=0)
    winners = [key for key, score in scores.items() if score == best and score > 0]
    return winners == [model_id]

class GUID(ctypes.Structure):
    _fields_ = [('data', ctypes.c_ubyte * 16)]

class DEVPROPKEY(ctypes.Structure):
    _fields_ = [('fmtid', GUID), ('pid', wintypes.DWORD)]

def identity(endpoint_id, api=None):
    api = api or ctypes.WinDLL('cfgmgr32')
    api.CM_Locate_DevNodeW.argtypes = [ctypes.POINTER(wintypes.ULONG), wintypes.LPWSTR, wintypes.ULONG]
    api.CM_Get_Parent.argtypes = [ctypes.POINTER(wintypes.ULONG), wintypes.ULONG, wintypes.ULONG]
    api.CM_Get_Device_IDW.argtypes = [wintypes.ULONG, wintypes.LPWSTR, wintypes.ULONG, wintypes.ULONG]
    api.CM_Get_DevNode_PropertyW.argtypes = [wintypes.ULONG, ctypes.POINTER(DEVPROPKEY), ctypes.POINTER(wintypes.ULONG), ctypes.c_void_p, ctypes.POINTER(wintypes.ULONG), wintypes.ULONG]
    node = wintypes.ULONG()
    if api.CM_Locate_DevNodeW(ctypes.byref(node), 'SWD\\MMDEVAPI\\' + endpoint_id, 0):
        return None
    for _ in range(16):
        name = ctypes.create_unicode_buffer(2048)
        if api.CM_Get_Device_IDW(node.value, name, len(name), 0):
            return None
        usb = re.match(r'^USB\\VID_([0-9A-F]{4})&PID_([0-9A-F]{4})', name.value.upper())
        if usb and any(':'.join(usb.groups()) in model['usbIds'] for model in CATALOG):
            key = DEVPROPKEY(GUID((ctypes.c_ubyte * 16).from_buffer_copy(uuid.UUID('8c7ed206-3f8a-4827-b3ab-ae9e1faefc6c').bytes_le)), 2)
            value, kind, size = GUID(), wintypes.ULONG(), wintypes.ULONG(16)
            if api.CM_Get_DevNode_PropertyW(node.value, ctypes.byref(key), ctypes.byref(kind), ctypes.byref(value), ctypes.byref(size), 0) == 0 and kind.value == 13:
                return {'container': str(uuid.UUID(bytes_le=bytes(value.data))), 'usbId': ':'.join(usb.groups())}
            # A matching interface alone cannot safely associate output and input.
            return None
        parent = wintypes.ULONG()
        if api.CM_Get_Parent(ctypes.byref(parent), node.value, 0):
            return None
        node = parent
    return None

def resolved_devices(devices, resolve=identity):
    seen, records, names = set(), [], {}
    for device in devices:
        if device.id in seen:
            continue
        seen.add(device.id)
        match = resolve(device.id)
        if not match:
            continue
        records.append((device, match))
        container = match if isinstance(match, str) else match['container']
        names.setdefault(container, []).append(getattr(device, 'FriendlyName', ''))
    return records, {key: ' '.join(value) for key, value in names.items()}

def inventory(devices, resolve=identity):
    records, names = resolved_devices(devices, resolve)
    connected = set()
    details = {}
    for device, match in records:
        if not isinstance(match, dict):
            continue
        for model in CATALOG:
            if matches_model(model['id'], match['usbId'], names[match['container']]):
                connected.add(model['id'])
                if model.get('transportOnly'):
                    text=names[match['container']]
                    label=re.search(r'XIBERIA[^()（）]*', text, re.I)
                    title=label.group(0).strip()[:80] if label else model['title']
                    details[model['id']]={'id':model['id'],'title':title}
    # Never expose endpoint/container identities in a card discovery result.
    result={'models': [model['id'] for model in CATALOG if model['id'] in connected]}
    if details:result['details']=list(details.values())
    return result

def select_endpoints(devices, flow, resolve=identity, model_id='k03s'):
    groups = {}
    records, names = resolved_devices(devices, resolve)
    for device, match in records:
        if isinstance(match, str):
            container = match  # A resolver test double may provide a proven container directly.
        else:
            if not matches_model(model_id, match['usbId'], names[match['container']]):
                continue
            container = match['container']
        direction = flow(device.id)
        if direction in (0, 1):
            groups.setdefault(container, {'output': [], 'input': []})['output' if direction == 0 else 'input'].append(device)
    if len(groups) != 1:
        return {'output': None, 'input': None}, len(groups) > 1
    group = next(iter(groups.values()))
    ambiguous = any(len(items) > 1 for items in group.values())
    return {key: items[0] if len(items) == 1 and not ambiguous else None for key, items in group.items()}, ambiguous

def snapshot(endpoints, ambiguous, include_target=False):
    values, capabilities = {}, {}
    for direction, device in endpoints.items():
        capabilities[direction] = False
        if device:
            control = device.EndpointVolume
            value = float(control.GetMasterVolumeLevelScalar()) * 100
            if not math.isfinite(value) or not 0 <= value <= 100.01:
                raise OSError('耳机音量读取失败')
            values[direction + 'Volume'] = round(value, 1)
            values[direction + 'Muted'] = bool(control.GetMute())
            capabilities[direction] = True
    state = {'connected': any(capabilities.values()) or ambiguous, 'transport': 'usb-audio', 'sampledAt': int(time.time() * 1000), 'values': values, 'capabilities': capabilities, 'ambiguous': ambiguous}
    if include_target:
        state['_renderEndpoint'] = endpoints['output'].id if endpoints['output'] else None
    return state

def execute(endpoints, ambiguous, command, value):
    if command == 'status':
        return snapshot(endpoints, ambiguous, True)
    mapping = {'setOutputVolume': ('output', 'volume'), 'setInputVolume': ('input', 'volume'), 'setOutputMute': ('output', 'mute'), 'setInputMute': ('input', 'mute')}
    if command not in mapping:
        raise ValueError('未知耳机操作')
    direction, kind = mapping[command]
    device = endpoints[direction]
    if not device or ambiguous:
        raise OSError('请连接一台对应型号的耳机后重试')
    control = device.EndpointVolume
    if kind == 'volume':
        if type(value) not in (int, float) or not math.isfinite(value) or not 0 <= value <= 100:
            raise ValueError('音量范围为 0–100')
        control.SetMasterVolumeLevelScalar(value / 100, None)
        if abs(control.GetMasterVolumeLevelScalar() * 100 - value) > 1:
            raise OSError('耳机音量设置未生效')
    else:
        if type(value) is not bool:
            raise ValueError('静音值无效')
        control.SetMute(int(value), None)
        if bool(control.GetMute()) != value:
            raise OSError('耳机静音设置未生效')
    return snapshot(endpoints, ambiguous, True)

def main():
    import comtypes
    from pycaw.pycaw import AudioUtilities
    from pycaw.api.mmdeviceapi import IMMEndpoint
    from pycaw.constants import DEVICE_STATE
    request = json.load(sys.stdin)
    comtypes.CoInitialize()
    try:
        flags = DEVICE_STATE.ACTIVE.value
        if request.get('command') == 'inventory':
            flags |= DEVICE_STATE.DISABLED.value
        devices = AudioUtilities.GetAllDevices(device_state=flags)
        if request.get('command') == 'inventory':
            return inventory(devices)
        model_id = os.environ.get('ONE4ALL_XIBERIA_ID', 'k03s')
        if model_id not in MODELS:
            raise ValueError('未知西伯利亚型号')
        endpoints, ambiguous = select_endpoints(devices, lambda endpoint: AudioUtilities.GetDeviceEnumerator().GetDevice(endpoint).QueryInterface(IMMEndpoint).GetDataFlow(), model_id=model_id)
        return execute(endpoints, ambiguous, request.get('command'), request.get('value'))
    finally:
        comtypes.CoUninitialize()

if __name__ == '__main__':
    try:
        print(json.dumps({'ok': True, 'state': main()}, ensure_ascii=True))
    except Exception as error:
        print(json.dumps({'ok': False, 'error': str(error)}, ensure_ascii=True))

"""Public, read-only keyboard capability model. SPDX-License-Identifier: MIT."""
import hashlib
import hmac
import time


def usage_name(page, usage):
    return {(1, 6): 'Keyboard', (1, 2): 'Mouse', (1, 0x80): 'System Control',
            (0x0C, 1): 'Consumer Control'}.get(
                (page, usage), 'Vendor Defined' if page >= 0xFF00 else 'HID')


def classify(vid, pid, keyboard, mouse):
    profiles = {(0x1532, 0x009F): 'mouse', (0x0C45, 0x8045): 'keyboard'}
    known = profiles.get((vid, pid))
    if known and ((known == 'keyboard' and keyboard) or (known == 'mouse' and mouse)):
        return {'kind': known, 'basis': '已登记型号与 HID 描述相符'}
    if keyboard and mouse:
        return {'kind': 'composite', 'basis': '同时包含标准键盘和鼠标集合'}
    if mouse:
        return {'kind': 'mouse', 'basis': '标准鼠标集合 0001/0002'}
    if keyboard:
        return {'kind': 'keyboard', 'basis': '标准键盘集合 0001/0006'}
    return {'kind': 'unknown', 'basis': '仅有待核验型号接口'}


def snapshot(records, session_salt):
    """Group only by a real container ID, never by a shared VID/PID."""
    groups = {}
    for index, record in enumerate(records):
        container = record.get('_container')
        key = ('container', container) if container else ('collection', record.get('_path', index))
        groups.setdefault(key, []).append(record)
    devices = []
    for identity, collections in groups.items():
        standard = any((r['usagePage'], r['usage']) == (1, 6) for r in collections)
        mouse = any((r['usagePage'], r['usage']) == (1, 2) for r in collections)
        tk_candidate = any((r['vendorId'], r['productId'], r['usagePage'], r['usage'],
                            r['outputBytes'], r['featureBytes']) ==
                           (0x1A2C, 0x9DFE, 0xFF01, 1, 8, 8) for r in collections)
        if not standard and not mouse and not tk_candidate:
            continue
        first = next((r for r in collections if (r['usagePage'], r['usage']) == (1, 6)), collections[0])
        opaque = hmac.new(session_salt, repr(identity).encode(), hashlib.sha256).hexdigest()[:20]
        public = [{k: r[k] for k in ('usagePage', 'usage', 'inputBytes', 'outputBytes', 'featureBytes')}
                  for r in collections]
        for collection in public:
            collection['usageName'] = usage_name(collection['usagePage'], collection['usage'])
        devices.append({
            'id': opaque, 'vendorId': first['vendorId'], 'productId': first['productId'],
            'version': first['version'], 'manufacturer': first.get('manufacturer', ''),
            'product': first.get('product', '') or 'HID 设备', 'connected': True,
            'grouping': 'container' if identity[0] == 'container' else 'collection-only',
            'standardKeyboard': standard, 'standardMouse': mouse, 'candidateProfiles': ['tk870-wired'] if tk_candidate else [],
            'detection': classify(first['vendorId'], first['productId'], standard, mouse),
            'protocolHints': ['qmk-raw-hid-interface'] if any((r['usagePage'], r['usage']) == (0xFF60, 0x61) for r in collections) else [],
            'collections': public,
            'capabilities': {'identity': True, 'collectionMetadata': True,
                             'keyTestScope': 'focused-window-all-keyboards',
                             'featureRead': False, 'lighting': False, 'remap': False,
                             'macros': False, 'reportRate': False},
        })
    return {'connected': bool(devices), 'sampledAt': int(time.time() * 1000), 'devices': devices,
            'readOnly': True, 'inputCapture': 'frontend-focus-only', 'protocolVerified': False}

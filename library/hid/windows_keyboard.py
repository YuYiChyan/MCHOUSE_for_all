"""Read Windows HID identity and collection metadata without device commands.

Uses only Windows HIDClass/SetupAPI and Python's standard library. No serial
numbers, keyboard hooks, input reads, output reports or feature requests.
SPDX-License-Identifier: MIT.
"""
import ctypes as c
import json
import os
import secrets
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from keyboard_model import snapshot

U16, U32, PTR = c.c_uint16, c.c_uint32, c.c_void_p


class Guid(c.Structure):
    _fields_ = [('a', U32), ('b', U16), ('d', U16), ('e', c.c_ubyte * 8)]


class Interface(c.Structure):
    _fields_ = [('size', U32), ('guid', Guid), ('flags', U32), ('reserved', c.c_size_t)]


class DevInfo(c.Structure):
    _fields_ = [('size', U32), ('guid', Guid), ('devinst', U32), ('reserved', c.c_size_t)]


class Attributes(c.Structure):
    _fields_ = [('size', U32), ('vid', U16), ('pid', U16), ('version', U16)]


class Caps(c.Structure):
    _fields_ = [('usage', U16), ('page', U16), ('input', U16), ('output', U16),
               ('feature', U16), ('reserved', U16 * 17), ('counts', U16 * 10)]


class PropertyKey(c.Structure):
    _fields_ = [('guid', Guid), ('pid', U32)]


def _signature(dll, name, result, arguments):
    fn = getattr(dll, name)
    fn.restype, fn.argtypes = result, arguments
    return fn


def enumerate_metadata():
    if sys.platform != 'win32':
        raise OSError('Windows HID metadata is available only on Windows')
    hid = c.WinDLL('hid.dll', use_last_error=True)
    setup = c.WinDLL('setupapi.dll', use_last_error=True)
    kernel = c.WinDLL('kernel32.dll', use_last_error=True)
    p = c.POINTER
    hid_guid = _signature(hid, 'HidD_GetHidGuid', None, [p(Guid)])
    get_attrs = _signature(hid, 'HidD_GetAttributes', c.c_ubyte, [PTR, p(Attributes)])
    get_preparsed = _signature(hid, 'HidD_GetPreparsedData', c.c_ubyte, [PTR, p(PTR)])
    free_preparsed = _signature(hid, 'HidD_FreePreparsedData', c.c_ubyte, [PTR])
    get_caps = _signature(hid, 'HidP_GetCaps', c.c_int32, [PTR, p(Caps)])
    product = _signature(hid, 'HidD_GetProductString', c.c_ubyte, [PTR, PTR, U32])
    manufacturer = _signature(hid, 'HidD_GetManufacturerString', c.c_ubyte, [PTR, PTR, U32])
    class_devs = _signature(setup, 'SetupDiGetClassDevsW', PTR, [p(Guid), c.c_wchar_p, PTR, U32])
    enum_interfaces = _signature(setup, 'SetupDiEnumDeviceInterfaces', c.c_int,
                                 [PTR, PTR, p(Guid), U32, p(Interface)])
    detail = _signature(setup, 'SetupDiGetDeviceInterfaceDetailW', c.c_int,
                        [PTR, p(Interface), PTR, U32, p(U32), p(DevInfo)])
    destroy = _signature(setup, 'SetupDiDestroyDeviceInfoList', c.c_int, [PTR])
    get_property = _signature(setup, 'SetupDiGetDevicePropertyW', c.c_int,
                              [PTR, p(DevInfo), p(PropertyKey), p(U32), PTR, U32, p(U32), U32])
    open_file = _signature(kernel, 'CreateFileW', PTR,
                           [c.c_wchar_p, U32, U32, PTR, U32, U32, PTR])
    close = _signature(kernel, 'CloseHandle', c.c_int, [PTR])
    container_key = PropertyKey(Guid.from_buffer_copy(uuid.UUID('8c7ed206-3f8a-4827-b3ab-ae9e1faefc6c').bytes_le), 2)
    invalid = c.c_void_p(-1).value
    guid = Guid()
    hid_guid(c.byref(guid))
    device_set = class_devs(c.byref(guid), None, None, 0x12)
    if device_set in (None, invalid):
        raise OSError('Windows HID enumeration could not be started')
    records = []
    skipped = 0
    try:
        index = 0
        while True:
            interface = Interface()
            interface.size = c.sizeof(interface)
            if not enum_interfaces(device_set, None, c.byref(guid), index, c.byref(interface)):
                if c.get_last_error() == 259:
                    break
                raise OSError('Windows HID interface enumeration failed')
            index += 1
            required = U32()
            detail(device_set, c.byref(interface), None, 0, c.byref(required), None)
            if required.value < 6 or required.value > 65536:
                skipped += 1
                continue
            buffer = c.create_string_buffer(required.value)
            c.cast(buffer, p(U32))[0] = 8 if c.sizeof(PTR) == 8 else 6
            device_info = DevInfo()
            device_info.size = c.sizeof(device_info)
            if not detail(device_set, c.byref(interface), buffer, required, None, c.byref(device_info)):
                skipped += 1
                continue
            # DevicePath begins after the DWORD, independent of x64 cbSize.
            device_path = c.wstring_at(c.addressof(buffer) + 4)
            # Zero desired access: never request ownership of keyboard input.
            handle = open_file(device_path, 0, 3, None, 3, 0, None)
            if handle in (None, invalid):
                skipped += 1
                continue
            try:
                attributes = Attributes()
                attributes.size = c.sizeof(attributes)
                preparsed = PTR()
                if not get_attrs(handle, c.byref(attributes)) or not get_preparsed(handle, c.byref(preparsed)):
                    skipped += 1
                    continue
                try:
                    caps = Caps()
                    if get_caps(preparsed, c.byref(caps)) != 0x110000:
                        skipped += 1
                        continue
                finally:
                    free_preparsed(preparsed)
                identity, kind, needed = c.create_string_buffer(16), U32(), U32()
                container = None
                if get_property(device_set, c.byref(device_info), c.byref(container_key),
                                c.byref(kind), identity, 16, c.byref(needed), 0) and kind.value == 13:
                    raw = bytes(identity)
                    if any(raw):
                        container = str(uuid.UUID(bytes_le=raw))
                strings = []
                for reader in (manufacturer, product):
                    text = c.create_unicode_buffer(256)
                    strings.append(text.value if reader(handle, text, c.sizeof(text)) else '')
                records.append({'_path': device_path, '_container': container,
                                'vendorId': attributes.vid, 'productId': attributes.pid,
                                'version': attributes.version, 'manufacturer': strings[0],
                                'product': strings[1], 'usagePage': caps.page, 'usage': caps.usage,
                                'inputBytes': caps.input, 'outputBytes': caps.output, 'featureBytes': caps.feature})
            finally:
                close(handle)
    finally:
        destroy(device_set)
    return records, skipped


def main():
    try:
        if len(sys.argv) != 2 or sys.argv[1] != '--status':
            raise ValueError('Only --status is supported; no raw HID operations are exposed')
        salt_hex = os.environ.get('ONE4ALL_HID_SESSION_SALT')
        salt = bytes.fromhex(salt_hex) if salt_hex else secrets.token_bytes(32)
        if len(salt) != 32:
            raise ValueError('Invalid session salt')
        records, skipped = enumerate_metadata()
        state = snapshot(records, salt)
        state['unavailableCollections'] = skipped
        print(json.dumps({'ok': True, 'state': state}, ensure_ascii=True))
    except Exception as error:
        print(json.dumps({'ok': False, 'error': str(error)}, ensure_ascii=True))
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

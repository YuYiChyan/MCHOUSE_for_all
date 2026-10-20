# SPDX-License-Identifier: MIT
"""Core Audio controls bound to the wired BlackShark V2 USB card, 1532:0529.

Never falls back to the system default endpoint. Does not send proprietary HID.
"""
import ctypes
from ctypes import wintypes
import json
import math
import os
import sys
import time
import eq_provider


def usb_parent(endpoint_id, api=None):
    """Resolve the AudioEndpoint PnP parent chain, without publishing instance IDs."""
    api = api or ctypes.WinDLL("cfgmgr32")
    api.CM_Locate_DevNodeW.argtypes = [ctypes.POINTER(wintypes.ULONG), wintypes.LPWSTR, wintypes.ULONG]
    api.CM_Get_Parent.argtypes = [ctypes.POINTER(wintypes.ULONG), wintypes.ULONG, wintypes.ULONG]
    api.CM_Get_Device_IDW.argtypes = [wintypes.ULONG, wintypes.LPWSTR, wintypes.ULONG, wintypes.ULONG]
    node = wintypes.ULONG()
    if api.CM_Locate_DevNodeW(ctypes.byref(node), "SWD\\MMDEVAPI\\" + endpoint_id, 0) != 0:
        return None
    for _ in range(12):
        buffer = ctypes.create_unicode_buffer(2048)
        if api.CM_Get_Device_IDW(node.value, buffer, len(buffer), 0) != 0:
            return None
        identity = buffer.value.upper()
        if identity.startswith("USB\\VID_1532&PID_0529"):
            return identity
        parent = wintypes.ULONG()
        if api.CM_Get_Parent(ctypes.byref(parent), node.value, 0) != 0:
            return None
        node = parent
    return None


def select_endpoints(devices, flow, parent=usb_parent):
    matched = {"output": [], "input": []}
    for device in devices:
        if not parent(device.id):
            continue
        direction = flow(device.id)
        if direction in (0, 1):
            matched["output" if direction == 0 else "input"].append(device)
    # Multiple physical cards are ambiguous. Refuse to choose one by list order.
    return {key: items[0] if len(items) == 1 else None for key, items in matched.items()}, {
        key: len(items) > 1 for key, items in matched.items()}


def snapshot(endpoints, ambiguous):
    values, caps, errors = {}, {}, {}
    for direction, device in endpoints.items():
        caps[direction] = device is not None
        if device:
            try:
                endpoint = device.EndpointVolume
                volume = float(endpoint.GetMasterVolumeLevelScalar()) * 100
                if not math.isfinite(volume) or not 0 <= volume <= 100.01:
                    raise ValueError("Core Audio returned invalid volume")
                values[direction + "Volume"] = round(volume, 1)
                values[direction + "Muted"] = bool(endpoint.GetMute())
            except Exception as exc:
                caps[direction] = False
                errors[direction] = str(exc)
    return {"connected": any(endpoints.values()), "transport": "usb-audio",
            "sampledAt": int(time.time() * 1000) if any(endpoints.values()) else None,
            "values": values, "capabilities": caps, "ambiguous": ambiguous, "errors": errors,
            "error": "检测到多个同型号端点，需接收方增加设备选择" if any(ambiguous.values()) else None}


def execute(endpoints, ambiguous, command, value):
    if command == "status":
        return snapshot(endpoints, ambiguous)
    mapping = {"setOutputVolume": ("output", "volume"), "setInputVolume": ("input", "volume"),
               "setOutputMute": ("output", "mute"), "setInputMute": ("input", "mute")}
    if command not in mapping:
        raise ValueError("Unsupported command")
    direction, kind = mapping[command]
    device = endpoints[direction]
    if not device:
        raise OSError("Matching USB audio endpoint is unavailable or ambiguous")
    endpoint = device.EndpointVolume
    if kind == "volume":
        if type(value) not in (int, float) or not math.isfinite(value) or not 0 <= value <= 100:
            raise ValueError("Volume must be between 0 and 100")
        endpoint.SetMasterVolumeLevelScalar(value / 100, None)
        if abs(endpoint.GetMasterVolumeLevelScalar() * 100 - value) > 1:
            raise OSError("Audio volume readback mismatch")
    else:
        if type(value) is not bool:
            raise ValueError("Mute requires a boolean")
        endpoint.SetMute(int(value), None)
        if bool(endpoint.GetMute()) != value:
            raise OSError("Audio mute readback mismatch")
    return snapshot(endpoints, ambiguous)


def main():
    import comtypes
    from pycaw.pycaw import AudioUtilities
    from pycaw.api.mmdeviceapi import IMMEndpoint
    from pycaw.constants import DEVICE_STATE
    request = json.load(sys.stdin)
    comtypes.CoInitialize()
    try:
        devices = AudioUtilities.GetAllDevices(device_state=DEVICE_STATE.ACTIVE.value)
        endpoints, ambiguous = select_endpoints(devices, lambda identity: AudioUtilities.GetDeviceEnumerator().GetDevice(identity).QueryInterface(IMMEndpoint).GetDataFlow())
        if request.get("command") == "setEq":
            if not endpoints["output"]:
                raise OSError("Matching output endpoint is required for EQ export or save")
            eq = eq_provider.save(os.environ.get("ONE4ALL_DEVICE_DATA"), endpoints["output"].id, request.get("value"))
            state = snapshot(endpoints, ambiguous)
        else:
            state = execute(endpoints, ambiguous, request.get("command"), request.get("value"))
            try:
                eq = eq_provider.status(os.environ.get("ONE4ALL_DEVICE_DATA"))
            except Exception as exc:
                eq = {"configured": False, "audibleVerified": None, "error": str(exc)}
        state["eq"] = eq
        state["spatial"] = {"nativeControl": False, "installedComponents": installed_thx(),
                            "enabled": None, "reason": "No validated public THX device-control API"}
        return state
    finally:
        comtypes.CoUninitialize()


def installed_thx():
    """Presence clues only: uninstall registration cannot prove APO activation."""
    import winreg
    names = set()
    for hive in (winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER):
        for view in (winreg.KEY_WOW64_64KEY, winreg.KEY_WOW64_32KEY):
            try:
                with winreg.OpenKey(hive, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall", 0, winreg.KEY_READ | view) as key:
                    for index in range(winreg.QueryInfoKey(key)[0]):
                        try:
                            with winreg.OpenKey(key, winreg.EnumKey(key, index)) as app:
                                name = str(winreg.QueryValueEx(app, "DisplayName")[0])
                                if "THX" in name.upper():
                                    names.add(name[:120])
                        except OSError:
                            continue
            except OSError:
                continue
    return sorted(names)


if __name__ == "__main__":
    try:
        print(json.dumps({"ok": True, "state": main()}, ensure_ascii=True))
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=True))

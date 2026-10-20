# SPDX-License-Identifier: GPL-2.0-or-later
# HID++ framing and feature layouts adapted from pwr-Solaar/Solaar.
# See ../THIRD_PARTY.md and vendor/Solaar-source.zip for the pinned source.
"""G309-only HID++ adapter. No receiver pairing, firmware or flash writes."""
import json
import secrets
import struct
import sys
import time

RATES = {0: 125, 1: 250, 2: 500, 3: 1000, 4: 2000, 5: 4000, 6: 8000}


def parse_dpis(data):
    result, offset = [], 0
    while offset + 2 <= len(data):
        value = int.from_bytes(data[offset:offset + 2], "big")
        offset += 2
        if not value:
            return result
        if value >> 13 == 7:
            step = value & 0x1fff
            end = int.from_bytes(data[offset:offset + 2], "big")
            offset += 2
            if not result or not step or end <= result[-1]:
                raise ValueError("Invalid DPI range")
            result.extend(range(result[-1] + step, end + 1, step))
        else:
            result.append(value)
        if len(result) > 65536:
            raise ValueError("DPI list too large")
    raise ValueError("Unterminated DPI list")


class Link:
    def __init__(self, handle, slot):
        self.handle, self.slot = handle, slot
        self.software_id = secrets.randbelow(15) + 1
        self.features = {}

    def request(self, index, function, params=b"", timeout=0.8):
        if len(params) > 16:
            raise ValueError("HID++ request too long")
        function = (function & 0xf0) | self.software_id
        packet = bytes([0x11, self.slot, index, function]) + params.ljust(16, b"\0")
        if self.handle.write(packet) != len(packet):
            raise OSError("HID++ write incomplete")
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            reply = bytes(self.handle.read(64, max(1, int((end - time.monotonic()) * 1000))))
            if len(reply) < 4 or reply[0] not in (0x10, 0x11):
                continue
            if reply[1] not in (self.slot, self.slot ^ 0xff):
                continue
            if reply[2] in (0xff, 0x8f) and len(reply) >= 6 and reply[3:5] == bytes([index, function]):
                raise OSError("HID++ device rejected request: %02x" % reply[5])
            if reply[2:4] == bytes([index, function]):
                return reply[4:]
        raise TimeoutError("HID++ timeout; wake mouse or close competing configuration tools")

    def feature(self, feature):
        if feature not in self.features:
            self.features[feature] = self.request(0, 0, feature.to_bytes(2, "big"))[0]
        return self.features[feature]

    def call(self, feature, function=0, params=b""):
        index = self.feature(feature)
        if not index:
            raise ValueError("Feature %04x unavailable" % feature)
        return self.request(index, function, params)

    def identify(self):
        nonce = secrets.token_bytes(1)
        reply = self.request(0, 0x10, b"\0\0" + nonce)
        if len(reply) < 3 or reply[0] < 2 or reply[2:3] != nonce:
            raise ValueError("HID++ identity handshake failed")
        length = self.call(0x0005)[0]
        if not 1 <= length <= 80:
            raise ValueError("Unexpected device name length")
        name = b""
        while len(name) < length:
            part = self.call(0x0005, 0x10, bytes([len(name)]))
            if not part:
                raise ValueError("Device name incomplete")
            name += part
        name = name[:length].decode("utf-8", errors="strict")
        if name.upper() not in ("G309", "G309 LIGHTSPEED"):
            raise ValueError("Paired device is not G309")
        return name


class G309:
    def __init__(self, link, transport, name):
        self.link, self.transport, self.name = link, transport, name

    def dpi_info(self):
        desc = self.link.call(0x2202, 0x10, b"\0")
        if len(desc) < 3:
            raise ValueError("DPI descriptor incomplete")
        choices = b""
        for page in range(32):
            reply = self.link.call(0x2202, 0x20, bytes([0, 0, page]))
            if len(reply) < 5:
                raise ValueError("DPI choices incomplete")
            choices += reply[3:]
            if choices[-2:] == b"\0\0":
                break
        values = parse_dpis(choices)
        state = self.link.call(0x2202, 0x50, b"\0")
        if len(state) < 10:
            raise ValueError("DPI state incomplete")
        x = int.from_bytes(state[1:3], "big") or int.from_bytes(state[3:5], "big")
        y = int.from_bytes(state[5:7], "big") or int.from_bytes(state[7:9], "big")
        if x not in values:
            raise ValueError("Device returned unsupported DPI")
        return {"dpi": x, "choices": values, "y": y, "hasY": bool(desc[2] & 1),
                "lod": state[9], "hasLod": bool(desc[2] & 2)}

    def mode(self):
        return self.link.call(0x8100, 0x20)[0] if self.link.feature(0x8100) else None

    def snapshot(self):
        values, caps, errors = {}, {}, {}
        mode = self.mode()
        values["onboardMode"] = {1: "onboard", 2: "host"}.get(mode, "unknown")
        caps["setHostMode"] = mode in (1, 2)
        if self.link.feature(0x2202):
            try:
                dpi = self.dpi_info()
                values["dpi"] = dpi["dpi"]
                caps["dpiValues"] = dpi["choices"]
                caps["setDpi"] = mode == 2
            except Exception as exc:
                errors["dpi"] = str(exc)
        if self.link.feature(0x8061):
            try:
                flags = int.from_bytes(self.link.call(0x8061, 0x10)[:2], "big")
                rates = [rate for bit, rate in RATES.items() if flags & (1 << bit)]
                rate = RATES.get(self.link.call(0x8061, 0x20)[0])
                # G309 receiver is advertised up to 1000Hz; never offer generic 8kHz options.
                caps["reportRates"] = [rate for rate in rates if rate <= 1000]
                caps["setReportRate"] = mode == 2 and self.transport == "lightspeed" and rate in caps["reportRates"]
                values["reportRate"] = rate
            except Exception as exc:
                errors["reportRate"] = str(exc)
        if self.link.feature(0x1004):
            try:
                battery = self.link.call(0x1004, 0x10)
                percent, level, status = battery[:3]
                if percent > 100:
                    raise ValueError("Invalid battery level")
                # Zero with a nonzero coarse level does not establish an exact 0% reading.
                values.update(battery=percent if percent or not level else None,
                              batteryLevel=level, batteryStatus=status)
            except Exception as exc:
                errors["battery"] = str(exc)
        return {"connected": True, "transport": self.transport, "sampledAt": int(time.time() * 1000),
                "name": self.name, "values": values, "capabilities": caps, "errors": errors}

    def execute(self, command, value):
        if command == "status":
            return self.snapshot()
        if command == "setHostMode":
            if type(value) is not bool or not self.link.feature(0x8100):
                raise ValueError("Host mode requires a boolean and feature 8100")
            requested = 2 if value else 1
            self.link.call(0x8100, 0x10, bytes([requested]))
            if self.mode() != requested:
                raise OSError("Device mode readback mismatch")
            return self.snapshot()
        if command not in ("setDpi", "setReportRate"):
            raise ValueError("Unsupported command")
        if self.mode() != 2:
            raise ValueError("Switch to host mode explicitly first; no automatic mode or flash changes")
        if type(value) is not int:
            raise ValueError("Integer value required")
        if command == "setDpi":
            dpi = self.dpi_info()
            if value not in dpi["choices"]:
                raise ValueError("DPI is not in the device-reported range")
            payload = b"\0" + struct.pack("!HHB", value, dpi["y"] if dpi["hasY"] else 0,
                                             dpi["lod"] if dpi["hasLod"] else 0)
            self.link.call(0x2202, 0x60, payload)
            if self.dpi_info()["dpi"] != value:
                raise OSError("DPI readback did not confirm the requested value")
        else:
            snapshot = self.snapshot()
            if not snapshot["capabilities"].get("setReportRate") or value not in snapshot["capabilities"].get("reportRates", []):
                raise ValueError("Report rate is not supported on this connection")
            bit = next(bit for bit, rate in RATES.items() if rate == value)
            self.link.call(0x8061, 0x30, bytes([bit]))
            if self.link.call(0x8061, 0x20)[0] != bit:
                raise OSError("Report rate readback did not confirm the requested value")
        return self.snapshot()


def connect(hid):
    candidates = [d for d in hid.enumerate(0x046d, 0) if d["product_id"] in (0xc547, 0xb03c)
                  and d.get("usage_page") == 0xff00 and d.get("usage") in (1, 2)]
    candidates.sort(key=lambda d: d.get("usage") != 2)
    failures = []
    for device in candidates:
        handle = hid.device()
        try:
            handle.open_path(device["path"])
            slots = (1, 2) if device["product_id"] == 0xc547 else (0xff,)
            for slot in slots:
                try:
                    link = Link(handle, slot)
                    name = link.identify()
                    return G309(link, "lightspeed" if device["product_id"] == 0xc547 else "bluetooth", name), handle
                except (OSError, ValueError, TimeoutError):
                    continue
        except OSError:
            failures.append("HID collection could not be opened")
        handle.close()
    return None, None


def main():
    import hid
    request = json.load(sys.stdin)
    if request.get("command") not in ("status", "setDpi", "setReportRate", "setHostMode"):
        raise ValueError("Unsupported command")
    device, handle = connect(hid)
    if not device:
        if request["command"] != "status":
            raise OSError("G309 is disconnected or its vendor HID collection is unavailable")
        return {"connected": False, "transport": "unknown", "sampledAt": None, "values": {}, "capabilities": {},
                "error": "未找到可响应的 G309；请唤醒鼠标并检查接收器／蓝牙连接"}
    try:
        return device.execute(request["command"], request.get("value"))
    finally:
        handle.close()


if __name__ == "__main__":
    try:
        print(json.dumps({"ok": True, "state": main()}, ensure_ascii=True))
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=True))

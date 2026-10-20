"""Protocol fixtures and endpoint binding tests; no hardware access."""
import importlib.util
from pathlib import Path
import unittest
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


g = load("g309", "logitech-g309/payload/g309_backend.py")
sys.path.insert(0, str(ROOT / "blackshark-v2/payload"))
a = load("blackshark", "blackshark-v2/payload/blackshark_backend.py")


class HidFixture:
    def __init__(self):
        self.replies, self.sent = [], []

    def write(self, packet):
        self.sent.append(packet)
        self.replies = [bytes([0x11, 9, packet[2], packet[3]]) + bytes(16),
                        bytes([0x11, packet[1], packet[2], packet[3]]) + b"\x42" + bytes(15)]
        return len(packet)

    def read(self, length, timeout):
        return self.replies.pop(0) if self.replies else []


class FeatureFixture:
    def __init__(self):
        self.writes, self.dpi, self.mode_value = [], 800, 2

    def feature(self, feature):
        return 1 if feature in (0x2202, 0x8100) else 0

    def call(self, feature, function=0, params=b""):
        if feature == 0x8100:
            if function == 0x10:
                self.writes.append((feature, function, params))
                self.mode_value = params[0]
            return bytes([self.mode_value])
        if function == 0x10:
            return b"\0\0\3"
        if function == 0x20:
            return b"\0\0\0\x03\x20\x06\x40\0\0" + bytes(7)
        if function == 0x50:
            return b"\0" + self.dpi.to_bytes(2, "big") + b"\0\0\x03\x20\0\0\x02" + bytes(6)
        if function == 0x60:
            self.writes.append((feature, function, params))
            # Deliberately simulate a firmware that acknowledges without applying.
            return bytes(16)
        raise AssertionError("unexpected request")


class Endpoint:
    def __init__(self, id, value=0.5):
        self.id, self.value, self.mute = id, value, False
        self.EndpointVolume = self
        self.writes = []

    def GetMasterVolumeLevelScalar(self):
        return self.value

    def SetMasterVolumeLevelScalar(self, value, context):
        self.writes.append(value)
        self.value = value

    def GetMute(self):
        return int(self.mute)

    def SetMute(self, value, context):
        self.mute = bool(value)


class BackendTests(unittest.TestCase):
    def test_dpi_range_and_invalid_range(self):
        self.assertEqual(g.parse_dpis(bytes.fromhex("0064e032012c0000")), [100, 150, 200, 250, 300])
        with self.assertRaises(ValueError):
            g.parse_dpis(bytes.fromhex("e00001000000"))

    def test_hid_packet_and_unrelated_slot(self):
        hid = HidFixture()
        link = g.Link(hid, 1)
        self.assertEqual(link.request(3, 0x50, b"\0")[0], 0x42)
        self.assertEqual(len(hid.sent[0]), 20)
        self.assertEqual(hid.sent[0][:3], b"\x11\x01\x03")

    def test_no_automatic_mode_write(self):
        link = FeatureFixture()
        link.mode_value = 1
        device = g.G309(link, "lightspeed", "G309")
        self.assertEqual(device.snapshot()["values"]["onboardMode"], "onboard")
        with self.assertRaises(ValueError):
            device.execute("setDpi", 1600)
        self.assertEqual(link.writes, [])

    def test_explicit_mode_change_and_restore(self):
        link = FeatureFixture()
        device = g.G309(link, "lightspeed", "G309")
        self.assertEqual(device.execute("setHostMode", False)["values"]["onboardMode"], "onboard")
        self.assertEqual(device.execute("setHostMode", True)["values"]["onboardMode"], "host")

    def test_dpi_write_preserves_other_axes_and_requires_readback(self):
        link = FeatureFixture()
        device = g.G309(link, "lightspeed", "G309")
        with self.assertRaisesRegex(OSError, "readback"):
            device.execute("setDpi", 1600)
        self.assertEqual(link.writes[-1][2], bytes.fromhex("000640032002"))

    def test_unknown_command_rejected(self):
        with self.assertRaises(ValueError):
            g.G309(FeatureFixture(), "lightspeed", "G309").execute("flashFirmware", 1)

    def test_audio_never_falls_back_to_default_device(self):
        other = Endpoint("other")
        endpoints, ambiguous = a.select_endpoints([other], lambda _: 0, parent=lambda _: None)
        self.assertFalse(a.snapshot(endpoints, ambiguous)["connected"])
        with self.assertRaises(OSError):
            a.execute(endpoints, ambiguous, "setOutputVolume", 80)
        self.assertEqual(other.writes, [])

    def test_ambiguous_audio_endpoints_are_not_selected(self):
        devices = [Endpoint("one"), Endpoint("two")]
        endpoints, ambiguous = a.select_endpoints(devices, lambda _: 0, parent=lambda _: "matched")
        self.assertIsNone(endpoints["output"])
        self.assertTrue(ambiguous["output"])

    def test_audio_value_validation_and_readback(self):
        endpoint = Endpoint("card")
        selected = {"input": endpoint, "output": None}
        ambiguous = {"input": False, "output": False}
        for bad in (float("nan"), float("inf"), -1, 101, True, "50"):
            with self.assertRaises(ValueError):
                a.execute(selected, ambiguous, "setInputVolume", bad)
        self.assertEqual(a.execute(selected, ambiguous, "setInputVolume", 33)["values"]["inputVolume"], 33)
        self.assertTrue(a.execute(selected, ambiguous, "setInputMute", True)["values"]["inputMuted"])

    def test_eq_configuration_is_bound_and_export_only_by_default(self):
        eq = a.eq_provider
        identity = "{0.0.0.00000000}.{00000000-1111-2222-3333-444444444444}"
        value = {"enabled": True, "gains": [6, 0, 0, 0, 0, 0, 0, 0, 0, 0]}
        text = eq.configuration(identity, value)
        self.assertIn('tolower(deviceGuid) == "{00000000-1111-2222-3333-444444444444}"', text)
        self.assertIn("Preamp: -6.0 dB", text)
        self.assertNotIn("Device: all", text)
        with tempfile.TemporaryDirectory() as temporary:
            result = eq.save(temporary, identity, value)
            self.assertFalse(result["saved"])
            self.assertIsNone(result["audibleVerified"])
            self.assertEqual(list(Path(temporary).iterdir()), [])
        for invalid in ([0] * 9, [13] * 10, [float("nan")] * 10):
            with self.assertRaises(ValueError):
                eq.validate({"enabled": True, "gains": invalid})


if __name__ == "__main__":
    unittest.main()

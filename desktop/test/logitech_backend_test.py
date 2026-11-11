"""Offline protocol fixtures; never opens HID devices or changes real hardware."""
import importlib.util
import struct
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('logitech_multi', Path(__file__).parents[1] / 'core/logitech-multi_backend.py')
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class FeatureDevice:
    def __init__(self, extended=False, host_mode=2, independent=True, mismatch=False):
        self.features = {0x8100, 0x1004, 0x2202 if extended else 0x2201, 0x8061 if extended else 0x8060}
        self.extended, self.host_mode, self.independent = extended, host_mode, independent
        self.x, self.y, self.lod = 800, 1200 if independent else 800, 2
        self.writes, self.mismatch = [], mismatch
        self.rate = 3 if extended else 1

    def feature(self, feature):
        return 1 if feature in self.features else 0

    def call(self, feature, function=0, params=b''):
        assert feature in self.features
        if feature == 0x8100:
            if function == 0x10:
                self.host_mode = params[0]
                self.writes.append((feature, function, params))
            return bytes([self.host_mode])
        if feature == 0x1004:
            return bytes([70, 4, 0, 0])
        if feature == 0x2201:
            if function == 0x10:
                return b'\0' + struct.pack('!HHHH', 400, 800, 1600, 0)
            if function == 0x20:
                return b'\0' + struct.pack('!HH', self.x, 800)
            if function == 0x30:
                self.writes.append((feature, function, params))
                if not self.mismatch:
                    self.x = int.from_bytes(params[1:3], 'big')
                return params
        if feature == 0x2202:
            if function == 0x10:
                return bytes([0, 0, 3 if self.independent else 2])
            if function == 0x20:
                choices = [600, 1200, 2400, 0] if params[1] else [400, 800, 1600, 0]
                return params + struct.pack('!HHHH', *choices)
            if function == 0x50:
                return b'\0' + struct.pack('!HHHHB', self.x, 800, self.y, 1200, self.lod)
            if function == 0x60:
                self.writes.append((feature, function, params))
                if not self.mismatch:
                    self.x, self.y, self.lod = struct.unpack('!HHB', params[1:])
                return params
        if feature in (0x8060, 0x8061):
            if function == (0x10 if self.extended else 0):
                return b'\0\x0f' if self.extended else b'\x8b'
            if function == (0x20 if self.extended else 0x10):
                return bytes([self.rate])
            self.writes.append((feature, function, params))
            self.rate = params[0]
            return params
        raise AssertionError((feature, function, params))


def mouse(link, transport='lightspeed', model='logitech-g309'):
    return bridge.Mouse(link, {'id': 'fixture', 'modelId': model, 'transport': transport})


class LogitechBridgeTest(unittest.TestCase):
    def test_response_must_match_receiver_slot_and_software_id(self):
        class Handle:
            def write(self, packet):
                self.replies = [bytes([0x11, 2, packet[2], packet[3], 55]),
                                bytes([0x11, 1, packet[2], packet[3] ^ 1, 66]),
                                bytes([0x11, 1, packet[2], packet[3], 77])]
                return len(packet)
            def read(self, *_):
                return self.replies.pop(0) if getattr(self, 'replies', []) else []
        self.assertEqual(bridge.Link(Handle(), 1).request(2, 0x10), b'M')

    def test_late_feature_reply_cannot_alias_the_next_feature_index(self):
        class Handle:
            packets, replies = [], []
            def write(self, packet):
                self.packets.append(packet)
                if len(self.packets) == 2:
                    previous = self.packets[0]
                    self.replies = [bytes([0x11, 1, 0, previous[3], 5, 0, 0]),
                                    bytes([0x11, 1, 0, packet[3], 7, 0, 0])]
                return len(packet)
            def read(self, *_):
                return self.replies.pop(0) if self.replies else []
        handle = Handle()
        link = bridge.Link(handle, 1, timeout=0.002)
        with self.assertRaises(TimeoutError):
            link.feature(0x8100)
        self.assertEqual(link.feature(0x2202), 7)
        self.assertNotEqual(handle.packets[0][3], handle.packets[1][3])
        self.assertNotIn(0x8100, link.features)

    def test_receiver_pid_and_product_name_do_not_identify_a_model(self):
        models = bridge.load_models()
        info = {'product_id': 0xc547}
        self.assertIsNone(bridge.match_model(models, info, {'ids': [], 'name': 'G309 LIGHTSPEED'}))
        result = bridge.match_model(models, info, {'ids': [0x40b1], 'kind': 3})
        self.assertEqual(result['id'], 'logitech-g309')
        self.assertIsNone(bridge.match_model(models, info, {'ids': [0x40b1], 'kind': 0}))

    def test_receiver_slots_and_same_model_instances_have_distinct_ids(self):
        first = {'path': b'receiver-a', 'product_id': 0xc547}
        second = {'path': b'receiver-b', 'product_id': 0xc547}
        identity = {'unit': '12345678'}
        ids = [bridge.control_id(first, 1, identity), bridge.control_id(first, 2, identity),
               bridge.control_id(second, 1, identity), bridge.control_id(first, 1, {'unit': '87654321'})]
        self.assertEqual(len(set(ids)), 4)

    def test_status_does_not_write_or_change_mode(self):
        link = FeatureDevice(host_mode=1)
        state = mouse(link).status()
        self.assertEqual(link.writes, [])
        self.assertEqual(state['values']['onboardMode'], 'onboard')
        self.assertFalse(state['capabilities']['dpi']['writable'])
        self.assertEqual(state['values']['battery'], 70)
        with self.assertRaises(ValueError):
            mouse(link).execute('dpi.set', 1600)
        self.assertEqual(link.writes, [])

    def test_ordinary_dpi_and_report_rate_use_interval_encoding(self):
        link = FeatureDevice(independent=False)
        device = mouse(link, model='logitech-g502-hero')
        device.execute('dpi.set', [1600, 1600])
        self.assertIn((0x2201, 0x30, b'\0\x06\x40'), link.writes)
        self.assertEqual(device.status()['capabilities']['pollRate']['options'], [125.0, 250.0, 500.0, 1000.0])
        device.execute('pollRate.set', 500)
        self.assertIn((0x8060, 0x20, b'\x02'), link.writes)

    def test_extended_dpi_preserves_independent_y_and_lift_off(self):
        link = FeatureDevice(extended=True)
        device = mouse(link)
        result = device.execute('dpi.set', 1600)
        self.assertEqual(result['values']['dpi'], [1600, 1200])
        self.assertTrue(result['capabilities']['dpi']['separateAxes'])
        self.assertEqual(result['capabilities']['dpi']['y']['options'], [600, 1200, 2400])
        self.assertIn((0x2202, 0x60, b'\0\x06\x40\x04\xb0\x02'), link.writes)
        with self.assertRaises(ValueError):
            device.execute('dpi.set', [1600, 1600])  # Y has its own range.

    def test_extended_rate_uses_enum_and_never_writes_bluetooth(self):
        link = FeatureDevice(extended=True)
        mouse(link).execute('pollRate.set', 500)
        self.assertIn((0x8061, 0x30, b'\x02'), link.writes)
        link.writes.clear()
        with self.assertRaises(ValueError):
            mouse(link, 'bluetooth').execute('pollRate.set', 1000)
        self.assertEqual(link.writes, [])

    def test_readback_mismatch_is_error_not_success(self):
        link = FeatureDevice(mismatch=True)
        with self.assertRaisesRegex(OSError, 'DPI'):
            mouse(link).execute('dpi.set', 1600)
        self.assertEqual(len(link.writes), 1)

    def test_mode_changes_only_on_explicit_command(self):
        link = FeatureDevice(host_mode=1)
        result = mouse(link).execute('hostMode.set', True)
        self.assertEqual(result['values']['onboardMode'], 'host')
        self.assertTrue(result['capabilities']['dpi']['writable'])
        self.assertEqual(link.writes, [(0x8100, 0x10, b'\x02')])

    def test_missing_feature_stays_hidden_and_failed_read_does_not_hide_battery(self):
        link = FeatureDevice()
        link.features.remove(0x8060)
        link.x = 999
        state = mouse(link).status()
        self.assertNotIn('pollRate', state['capabilities'])
        self.assertNotIn('dpi', state['capabilities'])
        self.assertIn('dpi', state['errors'])
        self.assertEqual(state['values']['battery'], 70)
        self.assertEqual(link.writes, [])


if __name__ == '__main__':
    unittest.main()

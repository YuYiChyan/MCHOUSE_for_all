"""Capability, grouping and privacy checks for the generic keyboard layer."""
import ctypes
import importlib.util
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'library/hid'))
from keyboard_model import snapshot, usage_name
from windows_keyboard import Guid, Interface, DevInfo, Attributes, Caps


def record(container='private-container-1', path='private-instance-path-1', page=1, usage=6, vid=1, pid=2, output=1, feature=0):
    return {'_container': container, '_path': path, 'vendorId': vid, 'productId': pid,
            'version': 0x110, 'manufacturer': 'Fixture', 'product': 'Fixture Keyboard',
            'usagePage': page, 'usage': usage, 'inputBytes': 8, 'outputBytes': output, 'featureBytes': feature}


class ModelTests(unittest.TestCase):
    def test_same_vid_pid_keeps_distinct_physical_devices(self):
        result = snapshot([record(), record(container='second-container')], b'x' * 32)
        self.assertEqual(len(result['devices']), 2)
        self.assertNotEqual(result['devices'][0]['id'], result['devices'][1]['id'])

    def test_container_groups_keyboard_and_vendor_collections(self):
        result = snapshot([record(), record(page=0xFF01, usage=1, output=8, feature=8)], b'x' * 32)
        self.assertEqual(len(result['devices']), 1)
        self.assertEqual(len(result['devices'][0]['collections']), 2)
        self.assertFalse(result['devices'][0]['capabilities']['lighting'])

    def test_missing_container_never_merges_by_vid_pid(self):
        result = snapshot([record(None, 'one'), record(None, 'two')], b'x' * 32)
        self.assertEqual(len(result['devices']), 2)
        self.assertEqual(result['devices'][0]['grouping'], 'collection-only')

    def test_public_output_omits_private_identity(self):
        result = snapshot([record()], b'x' * 32)
        text = json.dumps(result)
        self.assertNotIn('private-', text)
        self.assertNotIn('_path', text)
        self.assertNotIn('_container', text)
        other = snapshot([record()], b'y' * 32)
        self.assertNotEqual(result['devices'][0]['id'], other['devices'][0]['id'])

    def test_system_control_does_not_become_a_generic_keyboard(self):
        self.assertEqual(usage_name(1, 0x80), 'System Control')
        self.assertEqual(snapshot([record(usage=0x80)], b'x' * 32)['devices'], [])

    def test_mouse_collections_are_identified_without_enabling_private_controls(self):
        device = snapshot([record(usage=2)], b'x' * 32)['devices'][0]
        self.assertTrue(device['standardMouse'])
        self.assertFalse(device['standardKeyboard'])
        self.assertFalse(device['capabilities']['reportRate'])
        self.assertEqual(device['collections'][0]['usageName'], 'Mouse')

    def test_composite_is_not_blindly_classified_and_known_models_require_matching_usages(self):
        mixed = snapshot([record(), record(usage=2)], b'x' * 32)['devices'][0]
        self.assertEqual(mixed['detection']['kind'], 'composite')
        razer = snapshot([record(vid=0x1532, pid=0x009F), record(usage=2, vid=0x1532, pid=0x009F)], b'x' * 32)['devices'][0]
        self.assertEqual(razer['detection']['kind'], 'mouse')
        mismatched = snapshot([record(vid=0x1532, pid=0x009F)], b'x' * 32)['devices'][0]
        self.assertEqual(mismatched['detection']['kind'], 'keyboard')

    def test_qmk_raw_interface_is_only_a_hint_not_remapping_support(self):
        device = snapshot([record(), record(page=0xFF60, usage=0x61)], b'x' * 32)['devices'][0]
        self.assertEqual(device['protocolHints'], ['qmk-raw-hid-interface'])
        self.assertFalse(device['capabilities']['remap'])

    def test_tk870_descriptor_match_is_only_a_candidate(self):
        result = snapshot([record(page=0xFF01, usage=1, vid=0x1A2C, pid=0x9DFE, output=8, feature=8)], b'x' * 32)
        device = result['devices'][0]
        self.assertEqual(device['candidateProfiles'], ['tk870-wired'])
        self.assertFalse(device['standardKeyboard'])
        self.assertFalse(result['protocolVerified'])
        self.assertFalse(device['capabilities']['featureRead'])

    def test_disconnected_snapshot_clears_all_devices(self):
        result = snapshot([], b'x' * 32)
        self.assertFalse(result['connected'])
        self.assertEqual(result['devices'], [])

    def test_fixed_width_windows_layouts(self):
        self.assertEqual(ctypes.sizeof(Guid), 16)
        self.assertEqual(ctypes.sizeof(Attributes), 12)
        self.assertEqual(ctypes.sizeof(Caps), 64)
        expected = 32 if ctypes.sizeof(ctypes.c_void_p) == 8 else 28
        self.assertEqual(ctypes.sizeof(Interface), expected)
        self.assertEqual(ctypes.sizeof(DevInfo), expected)


if __name__ == '__main__':
    unittest.main()

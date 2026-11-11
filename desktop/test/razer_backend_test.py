"""No-device fixtures for identity selection and write/readback behavior."""
import importlib.util
import unittest
from pathlib import Path
from types import SimpleNamespace as Obj

spec = importlib.util.spec_from_file_location('razer_multi', Path(__file__).parents[1] / 'core/razer-multi_backend.py')
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class RazerBridgeTest(unittest.TestCase):
    def test_same_model_devices_keep_separate_control_identities(self):
        meta = Obj(type='mouse', transport='hid', vid=0x1532, pid=0x9f)
        interfaces = [Obj(path='device-a', vendor_id=0x1532, product_id=0x9f, feature_length=91, interface=0),
                      Obj(path='device-b', vendor_id=0x1532, product_id=0x9f, feature_length=91, interface=0),
                      Obj(path='keyboard-collection', vendor_id=0x1532, product_id=0x9f, feature_length=0, interface=0)]
        backend = Obj(enumerate=lambda **_: interfaces)
        database = Obj(get=lambda *_: meta)
        recipes = Obj(transport_params=lambda *_: {'index': 0})
        controls = bridge.enumerate_controls(backend, database, recipes)
        self.assertEqual(len(controls), 2)
        self.assertNotEqual(bridge.control_id(controls[0][1]), bridge.control_id(controls[1][1]))

    def test_bad_ranges_never_write_and_readback_mismatch_is_not_success(self):
        original_status = bridge.status
        cap = {'dpi': {'readable': True, 'writable': True, 'min': 100, 'max': 30000, 'step': 100}}
        bridge.status = lambda *_: {'capabilities': cap, 'values': {}, 'ok': True}
        writes = []
        device = Obj(set_dpi=lambda x, y: writes.append([x, y]), get_dpi=lambda: (800, 800))
        try:
            with self.assertRaises(ValueError):
                bridge.execute(device, None, 'dpi.set', [30100, 30100])
            with self.assertRaises(ValueError):
                bridge.execute(device, None, 'dpi.set', [850, 850])
            self.assertEqual(writes, [])
            reply = bridge.execute(device, None, 'dpi.set', [1600, 1600])
            self.assertFalse(reply['ok'])
            self.assertEqual(reply['actual'], [800, 800])
            self.assertEqual(writes, [[1600, 1600]])
        finally:
            bridge.status = original_status


if __name__ == '__main__':
    unittest.main()

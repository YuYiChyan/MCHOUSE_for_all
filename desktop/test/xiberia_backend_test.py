import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('xiberia_audio', Path(__file__).parents[1] / 'core/xiberia/audio_backend.py')
audio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audio)

class Endpoint:
    def __init__(self, identity, name):
        self.id = identity
        self.FriendlyName = name

class MatchingTests(unittest.TestCase):
    def test_shared_usb_id_keeps_t10g_distinct(self):
        self.assertTrue(audio.matches_model('xiberia-t10g', '36F9:D003', 'Speakers (XIBERIA T10G)'))
        self.assertFalse(audio.matches_model('xiberia-t10', '36F9:D003', 'Speakers (XIBERIA T10G)'))
        self.assertTrue(audio.matches_model('xiberia-t10', '36F9:D003', 'XIBERIA T10'))

    def test_old_s21_max_is_not_added_to_new_hub(self):
        for model in audio.CATALOG:
            self.assertFalse(audio.matches_model(model['id'], '36F9:D000', 'XIBERIA S21 MAX'))

    def test_output_and_input_must_share_actual_container(self):
        devices = [Endpoint('out', 'XIBERIA T10G'), Endpoint('mic', 'XIBERIA T10G'), Endpoint('default', 'System speakers')]
        resolve = lambda endpoint: None if endpoint == 'default' else {'container': 'headset-one', 'usbId': '36F9:D003'}
        selected, ambiguous = audio.select_endpoints(devices, lambda endpoint: int(endpoint == 'mic'), resolve, 'xiberia-t10g')
        self.assertFalse(ambiguous)
        self.assertEqual(selected['output'].id, 'out')
        self.assertEqual(selected['input'].id, 'mic')
        self.assertEqual(audio.inventory(devices, resolve)['models'], ['xiberia-t10g'])

    def test_two_same_model_headsets_do_not_fall_back_to_default(self):
        devices = [Endpoint('first', 'XIBERIA T10'), Endpoint('second', 'XIBERIA T10')]
        resolve = lambda endpoint: {'container': endpoint, 'usbId': '36F9:D003'}
        selected, ambiguous = audio.select_endpoints(devices, lambda endpoint: 0, resolve, 'xiberia-t10')
        self.assertTrue(ambiguous)
        self.assertEqual(selected, {'output': None, 'input': None})

if __name__ == '__main__':
    unittest.main()

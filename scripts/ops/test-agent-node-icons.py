#!/usr/bin/env python3
import copy
import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest
import sys
sys.dont_write_bytecode = True
from PIL import Image

spec = importlib.util.spec_from_file_location('icon_check', Path(__file__).with_name('check-agent-node-icons.py'))
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


class ImportValidationTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.source = Path(self.temp.name) / 'spritesheet.webp'
        image = Image.new('RGBA', (12, 6))
        image.putpixel((2, 2), (255, 0, 0, 255))
        image.putpixel((8, 2), (255, 0, 0, 255))
        image.save(self.source, lossless=True)
        digest = hashlib.sha256(self.source.read_bytes()).hexdigest()
        self.atlas = {'version': 1, 'sourceSha256': digest, 'sheet': {'width': 12, 'height': 6},
                      'viewport': {'width': 6, 'height': 6},
                      'review': {'sourceSha256': digest, 'date': '2026-10-09', 'method': 'test', 'animations': ['idle']},
                      'animations': {'idle': {'row': 0, 'fps': 6, 'frames': [
                          {'x': x, 'y': 0, 'width': 6, 'height': 6, 'offsetX': 0, 'offsetY': 0} for x in (0, 6)]}}}

    def test_complete_source(self):
        self.assertEqual(checker.validate_atlas(self.atlas, self.source), 2)

    def test_reject_invalid_imports(self):
        mutations = {
            'source replacement': lambda a: a.update(sourceSha256='0'*64),
            'stale review': lambda a: a['review'].update(sourceSha256='0'*64),
            'missing review': lambda a: a.pop('review'),
            'unreviewed action': lambda a: a['review'].update(animations=[]),
            'zero fps': lambda a: a['animations']['idle'].update(fps=0),
            'missing pixels': lambda a: a['animations']['idle']['frames'].pop(),
            'overlap': lambda a: a['animations']['idle']['frames'][1].update(x=0),
            'clipped body': lambda a: a['animations']['idle']['frames'][0].update(x=2, width=4),
            'out of bounds': lambda a: a['animations']['idle']['frames'][0].update(x=-1),
            'viewport overflow': lambda a: a['animations']['idle']['frames'][0].update(offsetX=1),
        }
        for label, mutate in mutations.items():
            with self.subTest(label=label):
                atlas = copy.deepcopy(self.atlas)
                mutate(atlas)
                with self.assertRaises(ValueError):
                    checker.validate_atlas(atlas, self.source)


if __name__ == '__main__':
    unittest.main()

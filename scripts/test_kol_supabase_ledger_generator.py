import hashlib
import importlib.util
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

module_path=Path(__file__).with_name('generate-kol-supabase-ledger-release.py')
spec=importlib.util.spec_from_file_location('ledgergen',module_path)
gen=importlib.util.module_from_spec(spec)
spec.loader.exec_module(gen)

class VerifiedStagingRelease(unittest.TestCase):
    def test_plan_contains_expected_count_and_bucket_preaction(self):
        _,steps=gen.inputs()
        self.assertEqual(len(steps),45)
        positions=[i for i,(step_id,_) in enumerate(steps) if step_id=='0090']
        self.assertEqual(len(positions),1)
        self.assertEqual(steps[positions[0]+1][0],'009')

    def test_generated_files_are_byte_exact(self):
        with TemporaryDirectory() as temp:
            output=Path(temp)/'out'
            manifest=gen.build(output)
            self.assertFalse(manifest['writes_permitted'])
            self.assertFalse(manifest['cli_history_compatible'])
            self.assertEqual(len(manifest['steps']),45)
            for step in manifest['steps']:
                self.assertEqual((output/'supabase/migrations'/step['filename']).read_bytes(),
                                 (gen.ROOT/step['source']).read_bytes())

    def test_verified_historical_sql_supports_complete_cli_directory(self):
        with TemporaryDirectory() as temp:
            folder=Path(temp)/'history'
            folder.mkdir()
            pins={}
            for i in range(17):
                historical=f'20260924{i:06d}_from_verified_ledger.sql'
                source=f'select {i};\n'.encode()
                (folder/historical).write_bytes(source)
                pins[historical]=hashlib.sha256(source).hexdigest()
            with patch.object(gen,'historical_pins',return_value=pins):
                result=gen.build(Path(temp)/'release',history_dir=folder)
            self.assertTrue(result['cli_history_compatible'])
            self.assertEqual(len(list((Path(temp)/'release/supabase/migrations').glob('*.sql'))),62)

    def test_changed_historical_sql_is_refused(self):
        with TemporaryDirectory() as temp:
            folder=Path(temp)/'history'
            folder.mkdir()
            historical='20260924060622_from_verified_ledger.sql'
            (folder/historical).write_bytes(b'changed content')
            with patch.object(gen,'historical_pins',return_value={historical:hashlib.sha256(b'original').hexdigest()}):
                with self.assertRaises(ValueError):
                    gen.build(Path(temp)/'release',history_dir=folder)
            self.assertFalse((Path(temp)/'release').exists())

    def test_historical_fingerprint_manifest_contains_17(self):
        self.assertEqual(len(gen.historical_pins()),17)

    def test_existing_target_refused(self):
        with TemporaryDirectory() as temp:
            with self.assertRaises(ValueError):
                gen.build(Path(temp))

    def test_source_repo_target_refused(self):
        with self.assertRaises(ValueError):
            gen.build(gen.ROOT/'supabase/test_bad_output')

if __name__=='__main__':
    unittest.main()

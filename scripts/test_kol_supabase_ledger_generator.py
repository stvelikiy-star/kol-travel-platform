import importlib.util
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

module_path=Path(__file__).with_name('generate-kol-supabase-ledger-release.py')
spec=importlib.util.spec_from_file_location('ledgergen',module_path)
gen=importlib.util.module_from_spec(spec)
spec.loader.exec_module(gen)

class VerifiedStagingRelease(unittest.TestCase):
    def test_plan_contains_expected_count_and_bucket_preaction(self):
        _,steps=gen.inputs()
        self.assertEqual(len(steps),45)
        positions=[i for i,(id,_) in enumerate(steps) if id=='0090']
        self.assertEqual(len(positions),1)
        self.assertEqual(steps[positions[0]+1][0],'009')

    def test_generated_files_are_byte_exact(self):
        with TemporaryDirectory() as temp:
            output=Path(temp)/'out'
            manifest=gen.build(output)
            self.assertFalse(manifest['writes_permitted'])
            self.assertEqual(len(manifest['steps']),45)
            for step in manifest['steps']:
                self.assertEqual((output/'supabase/migrations'/step['filename']).read_bytes(),
                                 (gen.ROOT/step['source']).read_bytes())

    def test_existing_target_refused(self):
        with TemporaryDirectory() as temp:
            with self.assertRaises(ValueError):
                gen.build(Path(temp))

    def test_source_repo_target_refused(self):
        with self.assertRaises(ValueError):
            gen.build(gen.ROOT/'supabase/test_bad_output')

if __name__=='__main__':
    unittest.main()

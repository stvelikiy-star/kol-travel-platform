import hashlib
import importlib.util
import io
from pathlib import Path
import tarfile
import unittest

spec=importlib.util.spec_from_file_location('offsite',Path(__file__).with_name('qa-kol-offsite-recovery.py'))
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def archive_bytes(*,tamper=False,extra_nested=False,traversal=False):
    files={f'data-{i}.txt':f'stored item {i}'.encode() for i in range(10)}
    manifest=''.join(hashlib.sha256(value).hexdigest()+'  '+name+'\n' for name,value in files.items()).encode()
    payload=io.BytesIO()
    with tarfile.open(fileobj=payload,mode='w') as archive:
        def add(name,data):
            info=tarfile.TarInfo(name)
            info.size=len(data)
            archive.addfile(info,io.BytesIO(data))
        for name,data in files.items():
            add('snapshot/'+name,b'altered' if tamper and name=='data-0.txt' else data)
        add('snapshot/SHA256SUMS',manifest)
        if extra_nested:
            add('snapshot/restore-evidence/SHA256SUMS',b'nested recovery evidence')
        if traversal:
            add('../escape',b'x')
    payload.seek(0)
    return payload

class OffsiteRecoveryValidation(unittest.TestCase):
    def test_valid_ten_file_backup(self):
        with tarfile.open(fileobj=archive_bytes()) as archive:
            self.assertEqual(module.verify_backup_tar(archive),10)

    def test_nested_rehearsal_manifest_not_confused_with_source(self):
        with tarfile.open(fileobj=archive_bytes(extra_nested=True)) as archive:
            self.assertEqual(module.verify_backup_tar(archive),10)

    def test_modified_backup_member_is_rejected(self):
        with tarfile.open(fileobj=archive_bytes(tamper=True)) as archive:
            with self.assertRaises(RuntimeError):
                module.verify_backup_tar(archive)

    def test_path_traversal_is_rejected(self):
        with tarfile.open(fileobj=archive_bytes(traversal=True)) as archive:
            with self.assertRaises(RuntimeError):
                module.verify_backup_tar(archive)

    def test_no_decryption_secret_inside_qa_source(self):
        code=Path(module.__file__).read_text()
        self.assertNotIn('KOL_BACKUP_KEY=',code.split('if __name__')[0])
        self.assertIn('passphrase-fd',code)

if __name__=='__main__':
    unittest.main()

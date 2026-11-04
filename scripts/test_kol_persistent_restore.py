import hashlib
import importlib.util
import io
from pathlib import Path
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('restore', Path(__file__).with_name('kol_persistent_restore.py'))
restore = importlib.util.module_from_spec(spec); spec.loader.exec_module(restore)


class RecoveryArchiveSafety(unittest.TestCase):
    def test_valid_archive_and_complete_checksums(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            files = {name: (name+'\n').encode() for name in restore.REQUIRED}
            files['SHA256SUMS'] = ''.join(hashlib.sha256(data).hexdigest()+'  '+name+'\n' for name,data in files.items()).encode()
            path = root/'backup.tar.gz'
            with tarfile.open(path,'w:gz') as tar:
                for name,data in files.items():
                    member = tarfile.TarInfo('kol-live-baseline-test/'+name);member.size=len(data);tar.addfile(member,io.BytesIO(data))
            target = restore.unpack(path,root)
            (target/'data.sql').write_text('edited')
            with self.assertRaises(restore.Refuse):
                restore.checked_files(target)

    def test_tar_traversal_links_and_unknown_entries_are_rejected(self):
        for name,link in [('kol-live-baseline-test/../../outside',False),('kol-live-baseline-test/data.sql',True),('kol-live-baseline-test/unreviewed',False)]:
            with self.subTest(name=name,link=link),tempfile.TemporaryDirectory() as temp:
                root=Path(temp);path=root/'backup.tar.gz'
                with tarfile.open(path,'w:gz') as tar:
                    member=tarfile.TarInfo(name)
                    if link:member.type=tarfile.SYMTYPE;member.linkname='/etc/passwd'
                    tar.addfile(member,io.BytesIO())
                with self.assertRaises(restore.Refuse):restore.unpack(path,root)

    def test_missing_and_duplicate_manifest_entries_are_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);(root/'data.sql').write_text('data')
            line=hashlib.sha256(b'data').hexdigest()+'  data.sql\n'
            for text in [line,line+line,hashlib.sha256(b'data').hexdigest()+'  ../data.sql\n']:
                (root/'SHA256SUMS').write_text(text)
                with self.assertRaises(restore.Refuse):restore.checked_files(root)

    def test_quoted_source_secret_is_parsed_without_shell_execution(self):
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'env';path.write_text("KOL_DATABASE_URL='postgresql://user:percent%secret@host/db'\n")
            self.assertEqual(restore.source_secret(path),'postgresql://user:percent%secret@host/db')

if __name__ == '__main__':unittest.main()

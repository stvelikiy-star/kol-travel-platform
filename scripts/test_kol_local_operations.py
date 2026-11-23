import hashlib
import io
import json
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import time
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import kol_local_operations as ops


@unittest.skipUnless(shutil.which('gpg'), 'GnuPG is required')
class CryptoTests(unittest.TestCase):
    def test_roundtrip_wrong_key_and_tampering(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            home = root / 'gpg'
            home.mkdir(mode=0o700)
            source = root / 'source'
            source.write_bytes(b'KOL restore data\x00' * 100)
            encrypted = root / 'encrypted'
            secret = 'test-only-independent-key-' * 3
            ops.gpg(source, encrypted, secret, home)
            clear = root / 'clear'
            ops.gpg(encrypted, clear, secret, home, decrypt=True)
            self.assertEqual(source.read_bytes(), clear.read_bytes())
            with self.assertRaises(subprocess.CalledProcessError):
                ops.gpg(encrypted, root / 'wrong', 'wrong-key', home, decrypt=True)
            altered = bytearray(encrypted.read_bytes())
            altered[-8] ^= 1
            encrypted.write_bytes(altered)
            with self.assertRaises(subprocess.CalledProcessError):
                ops.gpg(encrypted, root / 'tampered', secret, home, decrypt=True)

    def test_authenticated_unsafe_archive_is_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            home = root / 'home'
            home.mkdir(mode=0o700)
            clear = root / 'unsafe.tar'
            with tarfile.open(clear, 'w:') as archive:
                entry = tarfile.TarInfo('../escape')
                entry.size = 3
                archive.addfile(entry, io.BytesIO(b'bad'))
            encrypted = root / 'unsafe.gpg'
            ops.gpg(clear, encrypted, 'test-only-archive-key', home)
            encrypted.with_suffix('.json').write_text(json.dumps({
                'project': 'kol-live', 'sha256': ops.digest(encrypted),
                'plaintext_sha256': ops.digest(clear)}))
            workspace = root / 'verify'
            workspace.mkdir()
            with self.assertRaisesRegex(RuntimeError, 'Unexpected archive'):
                ops.verify_archive(encrypted, 'test-only-archive-key', workspace)
            self.assertFalse((root / 'escape').exists())


class SafetyTests(unittest.TestCase):
    def test_secret_is_stdin_only(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            with patch.object(ops, 'run') as runner:
                ops.gpg(root / 'in', root / 'out', 'private-test-key', root)
            args, kwargs = runner.call_args
            self.assertNotIn('private-test-key', str(args))
            self.assertEqual(kwargs['input'], b'private-test-key\n')

    def test_world_readable_credentials_are_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / 'private').mkdir()
            env = root / 'private/live.env'
            env.write_text('KOL_BACKUP_KEY=' + 'x' * 64)
            env.chmod(0o644)
            with patch.object(ops, 'ROOT', root):
                with self.assertRaisesRegex(RuntimeError, 'permissions'):
                    ops.config()

    def test_fresh_stale_and_modified_backup_health(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            backups = root / 'backups'
            backups.mkdir()
            operations = root / 'operations'
            operations.mkdir()
            archive = backups / 'backup-20261106T000000Z.tar.gpg'
            archive.write_bytes(b'authenticated-backup-placeholder')
            proof = operations / 'last-backup.json'
            proof.write_text(json.dumps({'status': 'PASS', 'file': archive.name,
                                         'sha256': hashlib.sha256(archive.read_bytes()).hexdigest()}))
            import os
            stale = time.time() - 31 * 3600
            os.utime(proof, (stale, stale))
            def healthy(args, **kwargs):
                return subprocess.CompletedProcess(args, 0, stdout='0\n' if 'psql' in args else 'running healthy\n')
            response = {'status': 'ok', 'dataSourceMode': 'supabase', 'databaseConnectivity': 'reachable', 'demoAccessEnabled': False}
            with patch.object(ops, 'ROOT', root), patch.object(ops, 'BACKUPS', backups), \
                    patch.object(ops.subprocess, 'run', side_effect=healthy), \
                    patch.object(ops.shutil, 'disk_usage', return_value=SimpleNamespace(free=20 * 1024 ** 3)):
                for scenario in ['fresh', 'stale', 'modified']:
                    os.utime(proof, (stale, stale) if scenario == 'stale' else None)
                    if scenario == 'modified':
                        os.utime(proof, None)
                        archive.write_bytes(b'modified')
                    with patch.object(ops.urllib.request, 'urlopen', return_value=io.BytesIO(json.dumps(response).encode())), patch('builtins.print'):
                        self.assertEqual(ops.health(), 0 if scenario == 'fresh' else 1)
                    self.assertEqual(json.loads((operations / 'health.json').read_text())['checks']['backup'], scenario == 'fresh')


if __name__ == '__main__':
    unittest.main()

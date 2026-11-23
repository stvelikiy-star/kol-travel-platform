#!/usr/bin/env python3
"""Owned KOL staging operations; no cloud writes or shared-service restarts."""
import argparse
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import tarfile
import tempfile
import urllib.request

ROOT = Path('/home/agent/kol-live')
BACKUPS = Path('/home/agent/kol-backups/scheduled')
CONTAINERS = ['kol-live-db-1', 'kol-live-auth-1', 'kol-live-rest-1',
              'kol-live-storage-1', 'kol-live-gateway-1', 'kol-platform-kol-web-1']
PATTERN = re.compile(r'backup-[0-9]{8}T[0-9]{6}Z\.tar\.gpg')


def run(args, **kw):
    kw.setdefault("timeout", 300)
    return subprocess.run(args, check=True, **kw)


def config():
    path = ROOT / 'private/live.env'
    if path.is_symlink() or path.stat().st_mode & 0o077:
        raise RuntimeError('KOL private environment permissions are unsafe')
    result = {}
    for line in path.read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key, value = line.split('=', 1)
            parts = shlex.split(value)
            if len(parts) == 1:
                result[key] = parts[0]
    if len(result.get('KOL_BACKUP_KEY', '')) < 32:
        raise RuntimeError('Independent backup key is missing or too short')
    return result


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def atomic_json(path, value):
    temporary = path.with_suffix('.partial')
    with temporary.open('w') as out:
        json.dump(value, out, indent=2)
        out.flush()
        os.fsync(out.fileno())
    temporary.replace(path)


def gpg(source, target, secret, home, decrypt=False):
    if target.exists():
        raise RuntimeError('Refusing to overwrite encryption output')
    args = ['gpg', '--no-options', '--homedir', str(home), '--batch', '--yes',
            '--pinentry-mode', 'loopback', '--no-symkey-cache', '--passphrase-fd', '0',
            '--output', str(target)]
    args += ['--decrypt'] if decrypt else ['--symmetric', '--cipher-algo', 'AES256']
    args += [str(source)]
    run(args, input=secret.encode() + b'\n', stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def verify_archive(path, secret, workspace):
    """Verify ciphertext checksum AND authenticated decryption before archive access."""
    metadata_path = path.with_suffix('.json')
    metadata = json.loads(metadata_path.read_text())
    if metadata.get('project') != 'kol-live' or metadata.get('sha256') != digest(path):
        raise RuntimeError('Backup checksum or identity mismatch')
    clear = workspace / 'verified.tar'
    home = workspace / 'gpg'
    home.mkdir(mode=0o700)
    gpg(path, clear, secret, home, decrypt=True)
    if digest(clear) != metadata.get('plaintext_sha256'):
        raise RuntimeError('Decrypted archive mismatch')
    with tarfile.open(clear, 'r:') as archive:
        members = archive.getmembers()
        if {m.name for m in members} != {'database.dump', 'roles.sql', 'manifest.json'} or len(members) != 3:
            raise RuntimeError('Unexpected archive members')
        if any(not m.isfile() or m.size > 10 * 1024 ** 3 for m in members):
            raise RuntimeError('Unsafe archive member')
        for m in members:
            with archive.extractfile(m) as src, (workspace / m.name).open('xb') as out:
                shutil.copyfileobj(src, out)
    return workspace / 'database.dump'


def backup():
    os.umask(0o077)
    cfg = config()
    operations = ROOT / 'operations'
    operations.mkdir(mode=0o700, exist_ok=True)
    BACKUPS.mkdir(mode=0o700, parents=True, exist_ok=True)
    if BACKUPS.is_symlink():
        raise RuntimeError('Backup destination must not be a symlink')
    with (operations / 'backup.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        identity = run(['docker', 'exec', 'kol-live-db-1', 'psql', '-U', 'postgres', '-d', 'postgres',
                        '-XAt', '-v', 'ON_ERROR_STOP=1', '-c',
                        "select project || ':' || instance_id from kol_ops.runtime_identity"],
                       capture_output=True, text=True).stdout.strip()
        if identity != 'kol-live:' + cfg.get('KOL_INSTANCE_ID', ''):
            raise RuntimeError('Refusing a different KOL database instance')
        if shutil.disk_usage(BACKUPS).free < 2 * 1024 ** 3:
            raise RuntimeError('Insufficient free disk for a safe backup')
        stamp = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        target = BACKUPS / ('backup-' + stamp + '.tar.gpg')
        if target.exists():
            raise RuntimeError('Backup already exists')
        with tempfile.TemporaryDirectory(prefix='.work-', dir=BACKUPS) as name:
            work = Path(name)
            dump = work / 'database.dump'
            with dump.open('xb') as out:
                run(['docker', 'exec', 'kol-live-db-1', 'pg_dump', '-U', 'postgres', '-d', 'postgres',
                     '-Fc', '--no-owner'], stdout=out, stderr=subprocess.PIPE)
            with dump.open('rb') as src:
                run(['docker', 'exec', '-i', 'kol-live-db-1', 'pg_restore', '-l'], stdin=src,
                    stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            roles = work / 'roles.sql'
            with roles.open('xb') as out:
                run(['docker', 'exec', 'kol-live-db-1', 'pg_dumpall', '-U', 'postgres',
                     '--roles-only', '--no-role-passwords'], stdout=out, stderr=subprocess.PIPE)
            manifest = {'project': 'kol-live', 'instance_id': cfg['KOL_INSTANCE_ID'], 'captured_at_utc': stamp,
                        'format': 'pg-custom-acl-no-owner-v1', 'database_sha256': digest(dump),
                        'storage_object_bytes_included': False, 'role_passwords_included': False}
            (work / 'manifest.json').write_text(json.dumps(manifest, indent=2))
            clear = work / 'backup.tar'
            with tarfile.open(clear, 'w:') as archive:
                for item in ['database.dump', 'roles.sql', 'manifest.json']:
                    archive.add(work / item, arcname=item, recursive=False)
            home = work / 'encrypt-home'
            home.mkdir(mode=0o700)
            encrypted = work / 'backup.gpg'
            gpg(clear, encrypted, cfg['KOL_BACKUP_KEY'], home)
            check = work / 'roundtrip.tar'
            gpg(encrypted, check, cfg['KOL_BACKUP_KEY'], home, decrypt=True)
            if digest(clear) != digest(check):
                raise RuntimeError('Encrypted backup roundtrip failed')
            meta = {**manifest, 'sha256': digest(encrypted), 'plaintext_sha256': digest(clear),
                    'bytes': encrypted.stat().st_size, 'decrypt_roundtrip_pass': True}
            encrypted.replace(target)
            atomic_json(target.with_suffix('.json'), meta)
            atomic_json(operations / 'last-backup.json', {'status': 'PASS', 'file': target.name, **meta})
        # Old manual recovery archives are never touched. Retain 14 managed successful copies.
        managed = sorted(p for p in BACKUPS.iterdir() if PATTERN.fullmatch(p.name) and not p.is_symlink())
        for old in managed[:-14]:
            try:
                meta = json.loads(old.with_suffix('.json').read_text())
                if meta.get('project') == 'kol-live' and meta.get('sha256') == digest(old):
                    old.unlink()
                    old.with_suffix('.json').unlink()
            except (OSError, ValueError):
                continue
        print('KOL_LOCAL_ENCRYPTED_BACKUP_PASS ' + target.name)


def health():
    os.umask(0o077)
    checks = {}
    for name in CONTAINERS:
        try:
            result = subprocess.run(['docker', 'inspect', '--format',
                                     '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}', name],
                                    capture_output=True, text=True, timeout=10)
            checks[name] = result.returncode == 0 and result.stdout.strip() == 'running healthy'
        except subprocess.TimeoutExpired:
            checks[name] = False
    try:
        with urllib.request.urlopen('http://127.0.0.1:3101/api/health', timeout=8) as response:
            app = json.load(response)
        checks['staging'] = app.get('status') == 'ok' and app.get('dataSourceMode') == 'supabase' and app.get('databaseConnectivity') == 'reachable' and app.get('demoAccessEnabled') is False
    except (OSError, ValueError):
        checks['staging'] = False
    try:
        proof = ROOT / 'operations/last-backup.json'
        meta = json.loads(proof.read_text())
        path = BACKUPS / meta['file']
        age = dt.datetime.now(dt.timezone.utc).timestamp() - proof.stat().st_mtime
        checks['backup'] = bool(PATTERN.fullmatch(path.name)) and 0 <= age < 30 * 3600 and meta.get('status') == 'PASS' and not path.is_symlink() and digest(path) == meta['sha256']
    except (OSError, ValueError, KeyError):
        checks['backup'] = False
    try:
        result = run(['docker', 'exec', 'kol-live-db-1', 'psql', '-U', 'postgres', '-d', 'postgres',
                      '-XAt', '-v', 'ON_ERROR_STOP=1', '-c', 'select count(*) from storage.objects'],
                     capture_output=True, text=True, timeout=10)
        checks['storage_has_no_unbacked_objects'] = int(result.stdout.strip()) == 0
    except (ValueError, subprocess.SubprocessError):
        checks['storage_has_no_unbacked_objects'] = False
    checks['disk_free_5gib'] = shutil.disk_usage(ROOT).free >= 5 * 1024 ** 3
    output = {'status': 'PASS' if all(checks.values()) else 'FAIL', 'checks': checks,
              'checked_at_utc': dt.datetime.now(dt.timezone.utc).isoformat(), 'external_reachability_verified': False}
    (ROOT / 'operations').mkdir(mode=0o700, exist_ok=True)
    atomic_json(ROOT / 'operations/health.json', output)
    print(json.dumps(output))
    return 0 if all(checks.values()) else 1


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['backup', 'health'])
    args = parser.parse_args()
    if args.action == 'backup':
        backup()
        return 0
    return health()


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as exc:
        # Never print command payloads, credentials or private stderr diagnostics.
        print('KOL_LOCAL_OPERATIONS_FAILED ' + type(exc).__name__)
        raise SystemExit(1)

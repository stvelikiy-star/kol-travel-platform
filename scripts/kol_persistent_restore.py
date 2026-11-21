#!/usr/bin/env python3
"""Restore a verified encrypted recovery archive into one empty private KÖL instance.

The API remains stopped after import, pending migration/security acceptance.
No source connection, role-password replay, volume deletion or app cutover.
"""
import argparse
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import re
import shlex
import subprocess
import sys
import tarfile
import tempfile
import time

INFRA_SHA = '07fc1eca55c312815549a83837fbd3fc4839ca23'
REQUIRED = {'metadata.txt','baseline.sql','source-baseline.tsv','source-extensions.tsv',
            'source-custom-roles.tsv','roles.sql','schema.sql','migration-schema.sql','migration-data.sql','data.sql'}


class Refuse(RuntimeError):
    pass


def checked_files(directory):
    """Check every listed file, reject traversal/duplicates and missing coverage."""
    verified = set()
    for line in (directory / 'SHA256SUMS').read_text().splitlines():
        match = re.fullmatch(r'([a-f0-9]{64}) [ *](.+)', line)
        if not match:
            raise Refuse('Malformed checksum manifest')
        digest, name = match.groups()
        if name not in REQUIRED or name in verified:
            raise Refuse('Unexpected or duplicate backup manifest entry')
        path = directory / name
        if not path.is_file() or path.is_symlink() or hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise Refuse('Backup checksum mismatch: ' + name)
        verified.add(name)
    if verified != REQUIRED:
        raise Refuse('Backup checksum manifest is incomplete')


def unpack(archive, destination):
    """Extract regular known files only, never tar links, devices or paths."""
    with tarfile.open(archive, 'r:gz') as tar:
        members = tar.getmembers()
        roots = {PurePosixPath(m.name).parts[0] for m in members if PurePosixPath(m.name).parts}
        if len(roots) != 1:
            raise Refuse('Archive must have exactly one backup root')
        top = next(iter(roots))
        if not re.fullmatch(r'kol-live-baseline-[A-Za-z0-9_-]+', top):
            raise Refuse('Unexpected backup root')
        target = destination / top
        target.mkdir(mode=0o700)
        seen = set()
        total = 0
        for member in members:
            path = PurePosixPath(member.name)
            if member.isdir() and path.parts == (top,):
                continue
            if (not member.isfile() or len(path.parts) != 2 or path.parts[0] != top
                    or path.parts[1] not in REQUIRED | {'SHA256SUMS'} or member.name in seen):
                raise Refuse('Unsafe or unexpected archive member')
            total += member.size
            if total > 2 * 1024 ** 3:
                raise Refuse('Recovery archive exceeds reviewed 2 GiB limit')
            seen.add(member.name)
            data = tar.extractfile(member).read()
            fd = os.open(target / path.name, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, 'wb') as out:
                out.write(data)
    checked_files(target)
    return target


def source_secret(path):
    for line in path.read_text().splitlines():
        if line.startswith('KOL_DATABASE_URL='):
            values = shlex.split(line.split('=', 1)[1])
            if len(values) == 1 and values[0].startswith(('postgres://','postgresql://')):
                return values[0]
    raise Refuse('Saved recovery decryption secret is missing or invalid')


def import_backup(runtime, root, assets, instance, backup, evidence):
    state, env = runtime.prepare(root, assets, 'http://127.0.0.1:54331', 'http://127.0.0.1:3100')
    if instance != state['instance_id'] or not re.fullmatch('[a-f0-9]{32}', instance):
        raise Refuse('Expected instance does not match the persistent runtime')
    runtime.preflight(root)
    command = runtime.compose_command(root, assets)

    def sql(query):
        # Execute inside the owned DB: never accept a user-supplied connection URL.
        p = subprocess.run(command + ['exec','-T','-e','LC_ALL=C','db','psql','-X','-q','-A','-F','\t','-P','footer=off',
            '-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'], input=query, capture_output=True, text=True,
            env={**os.environ, **env})
        if p.returncode:
            (evidence / 'database-error.log').write_text(p.stderr)
            raise Refuse('Database operation failed; private diagnostics retained; API stays closed')
        return p.stdout

    def identity():
        actual = sql("select project || ':' || instance_id from kol_ops.runtime_identity;\n").strip().splitlines()[-1]
        if actual != 'kol-live:' + instance:
            raise Refuse('Database identity mismatch; import refused')

    identity()
    checked_files(backup)
    if (backup / 'source-custom-roles.tsv').read_text().strip():
        raise Refuse('Custom source roles need a reviewed restore plan')
    baseline_lines = (backup / 'source-baseline.tsv').read_text().splitlines()
    if len(baseline_lines) != 2:
        raise Refuse('Expected a single source baseline row')
    baseline = dict(zip(baseline_lines[0].split('\t'), baseline_lines[1].split('\t')))
    if any(baseline.get(k) != '0' for k in ('storage_buckets','storage_objects')):
        raise Refuse('Nonempty source Storage requires a separate verified file restore')
    source_extensions = {line.split('\t')[0] for line in (backup / 'source-extensions.tsv').read_text().splitlines()}
    target_extensions = set(sql('select extname from pg_extension order by extname;\n').strip().splitlines())
    # psql without -t includes the heading, harmless to subset comparison.
    if not source_extensions <= target_extensions:
        raise Refuse('Required target extensions are missing')

    def empty():
        result = sql("select (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE')::text || ':' || (select count(*) from auth.users)::text || ':' || (select count(*) from storage.buckets)::text || ':' || (select count(*) from storage.objects)::text;\n").strip().splitlines()[-1]
        if result != '0:0:0:0':
            raise Refuse('Target is not empty; existing data preserved without restore')

    empty()
    # Stop only the owned API stack, then recheck identity and emptiness. Remain
    # stopped even on success until all staged security migrations are verified.
    runtime.run(command + ['stop','gateway','auth','rest','storage'])
    identity()
    empty()
    filtered = []
    chunks = []
    for name in ('schema.sql','migration-schema.sql'):
        lines = []
        for line in (backup / name).read_text().splitlines():
            if re.fullmatch(r'\s*ALTER .* OWNER TO "?supabase_admin"?;\s*', line):
                filtered.append(line)
                lines.append('-- KOL reserved managed owner statement omitted')
            else:
                lines.append(line)
        chunks.append('\n'.join(lines) + '\n')
    (evidence / 'filtered-managed-owner-lines.txt').write_text('\n'.join(filtered) + '\n')
    restore = 'BEGIN;\n' + ''.join(chunks) + '\nSET session_replication_role = replica;\n'
    restore += (backup / 'migration-data.sql').read_text() + '\n' + (backup / 'data.sql').read_text()
    restore += '\nCOMMIT;\n'
    (evidence / 'restore-output.log').write_text(sql(restore))
    restored = sql((backup / 'baseline.sql').read_text())
    (evidence / 'restore-baseline.tsv').write_text(restored)
    if restored != (backup / 'source-baseline.tsv').read_text():
        raise Refuse('Restored baseline differs; API stays closed for investigation')
    identity()
    result = {'status':'KOL_PERSISTENT_BASELINE_RESTORED','instance_id':instance,
              'data_restored':True,'migrations_applied':False,'api_stopped':True,
              'application_switched':False,'production_ready':False,
              'baseline_sha256':hashlib.sha256(restored.encode()).hexdigest()}
    runtime.private_write(root / 'baseline-restore-proof.json', json.dumps(result, indent=2) + '\n')
    (evidence / 'result.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--instance', required=True)
    parser.add_argument('--root', type=Path, default=Path.home() / 'kol-live')
    parser.add_argument('--recovery', type=Path, required=True)
    parser.add_argument('--source-secret-file', type=Path, default=Path.home() / 'kol-secure/.env')
    args = parser.parse_args()
    root = args.root.absolute()
    if root.is_symlink():
        raise Refuse('Runtime root must not be a symbolic link')
    bundle = root / 'releases' / INFRA_SHA
    assets = bundle / 'ops/ubuntu/live'
    spec = importlib.util.spec_from_file_location('runtime', bundle / 'scripts/kol_live_runtime.py')
    runtime = importlib.util.module_from_spec(spec); spec.loader.exec_module(runtime)
    state = json.loads((root / 'state.json').read_text())
    if state.get('instance_id') != args.instance:
        raise Refuse('Wrong persistent instance; no services changed')
    os.umask(0o077)
    with open(root / 'private/restore.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if (root / 'baseline-restore-proof.json').exists():
            raise Refuse('Baseline was already restored; repeat import is prohibited')
        recovery = args.recovery.resolve()
        result = (recovery / 'evidence/result.txt').read_text()
        if 'status=RESTORE_AND_MIGRATION_REHEARSAL_PASS\n' not in result or 'rollback_to_source_baseline=PASS\n' not in result:
            raise Refuse('Successful recovery and rollback evidence required')
        archives = list(recovery.glob('kol-live-baseline-*.tar.gz.enc'))
        if len(archives) != 1:
            raise Refuse('Expected exactly one encrypted recovery archive')
        archive = archives[0]
        expected = Path(str(archive) + '.sha256').read_text().split()[0]
        if hashlib.sha256(archive.read_bytes()).hexdigest() != expected:
            raise Refuse('Encrypted backup checksum mismatch')
        evidence = root / ('restore-' + time.strftime('%Y%m%dT%H%M%SZ', time.gmtime()))
        evidence.mkdir(mode=0o700)
        with tempfile.TemporaryDirectory(prefix='unpacked-', dir=evidence) as temporary:
            destination = Path(temporary)
            plain = destination / 'backup.tar.gz'
            secret = source_secret(args.source_secret_file)
            p = subprocess.run(['openssl','enc','-d','-aes-256-cbc','-pbkdf2','-iter','250000','-md','sha256',
                '-in',str(archive),'-out',str(plain),'-pass','stdin'],input=secret+'\n',text=True,capture_output=True)
            if p.returncode:
                raise Refuse('Cannot decrypt saved backup; no services changed')
            backup = unpack(plain, destination)
            proof = import_backup(runtime, root, assets, args.instance, backup, evidence)
        (evidence / 'encrypted-archive.sha256').write_text(expected + '\n')
        print(json.dumps(proof, indent=2))
        print('Baseline imported. API remains stopped pending migration/security acceptance.')


if __name__ == '__main__':
    try:
        main()
    except (Refuse, OSError, ValueError, KeyError, tarfile.TarError) as exc:
        print('STOP: ' + str(exc), file=sys.stderr)
        sys.exit(1)

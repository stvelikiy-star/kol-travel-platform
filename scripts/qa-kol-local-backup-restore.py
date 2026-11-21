#!/usr/bin/env python3
"""Restore the latest managed local backup in a networkless disposable PostgreSQL."""
import json
import datetime as dt
from pathlib import Path
import subprocess
import tempfile
import time
import uuid
import kol_local_operations as ops


def command(args, **kwargs):
    return subprocess.run(args, check=True, timeout=300, **kwargs)


def sql(container, query):
    return command(['docker', 'exec', '-i', container, 'psql', '-h', '/tmp' if container != 'kol-live-db-1' else '/var/run/postgresql',
                    '-U', 'postgres', '-d', 'postgres', '-XAt', '-v', 'ON_ERROR_STOP=1'],
                   input=query, capture_output=True, text=True).stdout.strip()


def ident(value):
    return '"' + value.replace('"', '""') + '"'


def main():
    cfg = ops.config()
    proof = json.loads((ops.ROOT / 'operations/last-backup.json').read_text())
    name = proof['file']
    if not ops.PATTERN.fullmatch(name):
        raise RuntimeError('Unexpected backup filename')
    image = command(['docker', 'inspect', '--format', '{{.Config.Image}}', 'kol-live-db-1'], capture_output=True, text=True).stdout.strip()
    if not image.startswith('supabase/postgres:17.') or '@sha256:' not in image:
        raise RuntimeError('Unreviewed PostgreSQL image')
    container = 'kol-backup-verify-' + uuid.uuid4().hex[:12]
    tables = json.loads(sql('kol-live-db-1', "select json_agg(json_build_array(schemaname,tablename) order by schemaname,tablename) from pg_tables where schemaname in ('public','auth','storage','kol_ops','supabase_migrations');"))
    roles = json.loads(sql('kol-live-db-1', "select json_agg(json_build_object('name',rolname,'bypass',rolbypassrls,'inherit',rolinherit)) from pg_roles where rolname !~ '^pg_' and rolname <> 'postgres';"))
    def fingerprint(target):
        rows = []
        for schema, table in tables:
            key = (schema + '.' + table).replace("'", "''")
            rows.append("select '" + key + "',count(*),md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by md5(row_to_json(t)::text)),'')) from " + ident(schema) + '.' + ident(table) + ' t')
        return sql(target, ';'.join(rows) + ';')
    before = fingerprint('kol-live-db-1')
    started = False
    with tempfile.TemporaryDirectory(prefix='.restore-', dir=ops.BACKUPS) as directory:
        workspace = Path(directory)
        dump = ops.verify_archive(ops.BACKUPS / name, cfg['KOL_BACKUP_KEY'], workspace)
        try:
            command(['docker', 'run', '-d', '--name', container, '--network', 'none', '--memory', '512m', '--pids-limit', '100',
                     '--user', 'postgres', '--entrypoint', '/bin/bash', '--tmpfs', '/tmp:rw,size=384m', image, '-c',
                     'initdb -D /tmp/verify-db -A trust >/tmp/init.log && exec postgres -D /tmp/verify-db -k /tmp -c listen_addresses= -c shared_buffers=16MB'],
                    stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            started = True
            for attempt in range(20):
                ready = subprocess.run(['docker', 'exec', container, 'pg_isready', '-h', '/tmp'], capture_output=True)
                if ready.returncode == 0:
                    break
                time.sleep(.5)
            else:
                raise RuntimeError('Isolated PostgreSQL was not ready')
            for role in roles:
                sql(container, 'create role ' + ident(role['name']) + ' nologin ' + ('bypassrls' if role['bypass'] else 'nobypassrls') + ' ' + ('inherit' if role['inherit'] else 'noinherit') + ';')
            with dump.open('rb') as archive:
                command(['docker', 'exec', '-i', container, 'pg_restore', '-h', '/tmp', '-U', 'postgres', '-d', 'postgres',
                         '--no-owner', '--clean', '--if-exists', '--exit-on-error'], stdin=archive, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            after = fingerprint(container)
            if before != after:
                raise RuntimeError('Restored table fingerprints differ; inspect source changes before blaming the archive')
            result = {'status': 'PASS', 'backup': name, 'matching_tables': len(tables), 'network': 'none',
                      'source_modified': False, 'checked_at_utc': dt.datetime.now(dt.timezone.utc).isoformat(),
                      'physical_storage_object_bytes_verified': False,
                      'role_passwords_restored': False}
            ops.atomic_json(ops.ROOT / 'operations/last-restore.json', result)
            print(json.dumps(result))
        finally:
            if started:
                command(['docker', 'rm', '-f', container], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as error:
        print('KOL_LOCAL_RESTORE_FAILED ' + type(error).__name__)
        raise SystemExit(1)

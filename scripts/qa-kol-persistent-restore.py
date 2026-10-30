#!/usr/bin/env python3
"""Synthetic import probe. Only a new disposable CI runtime is permitted."""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import shutil
import subprocess
import tarfile
import tempfile


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec); spec.loader.exec_module(value)
    return value


root, assets = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
if not str(root).startswith('/tmp/kol-live-ci-'):
    raise SystemExit('Only a disposable CI namespace is allowed')
runtime = module('runtime', Path(__file__).with_name('kol_live_runtime.py'))
restore = module('restore', Path(__file__).with_name('kol_persistent_restore.py'))
state = json.loads((root / 'state.json').read_text())
backup = root / 'synthetic-backup'
backup.mkdir(mode=0o700)
evidence = root / 'synthetic-evidence'
evidence.mkdir(mode=0o700)
query = "select (select count(*) from public.kol_import_probe) as probe_rows,(select count(*) from auth.users) as auth_users,(select count(*) from storage.buckets) as storage_buckets,(select count(*) from storage.objects) as storage_objects;\n"
files = {
 'metadata.txt':'Synthetic fixture; not actual source data\n',
 'baseline.sql':query,
 'source-baseline.tsv':'probe_rows\tauth_users\tstorage_buckets\tstorage_objects\n1\t1\t0\t0\n',
 'source-extensions.tsv':'plpgsql\t1.0\n',
 'source-custom-roles.tsv':'',
 'roles.sql':'-- managed roles must never be replayed\n',
 'schema.sql':"create table public.kol_import_probe (id int primary key, note text);\nalter table public.kol_import_probe enable row level security;\n",
 'migration-schema.sql':'create schema supabase_migrations; create table supabase_migrations.schema_migrations (version text primary key);\n',
 'migration-data.sql':"insert into supabase_migrations.schema_migrations values ('fixture');\n",
 'data.sql':"insert into public.kol_import_probe values (1,'preserved');\ninsert into auth.users (id,aud,role,email) values ('10000000-0000-0000-0000-000000000001','authenticated','authenticated','fixture@example.invalid');\n"
}
for name, content in files.items():
    runtime.private_write(backup / name, content)
runtime.private_write(backup / 'SHA256SUMS', ''.join(hashlib.sha256(content.encode()).hexdigest()+'  '+name+'\n' for name,content in files.items()))
# Wrong identity must be rejected without stopping or mutating services.
try:
    restore.import_backup(runtime, root, assets, '0'*32, backup, evidence)
    raise AssertionError('wrong instance was accepted')
except restore.Refuse:
    pass
before = (root / 'private/live.env').read_bytes()
# Exercise the complete CLI: installed immutable bundle, encrypted archive,
# saved secret parsing, safe extraction, identity gate and actual import.
bundle = root / 'releases' / restore.INFRA_SHA
(bundle / 'scripts').mkdir(parents=True)
shutil.copyfile(Path(__file__).with_name('kol_live_runtime.py'), bundle / 'scripts/kol_live_runtime.py')
shutil.copytree(assets, bundle / 'ops/ubuntu/live')
recovery = root / 'synthetic-recovery'
(recovery / 'evidence').mkdir(parents=True)
(recovery / 'evidence/result.txt').write_text('status=RESTORE_AND_MIGRATION_REHEARSAL_PASS\nrollback_to_source_baseline=PASS\n')
secret_file = root / 'synthetic-source.env'
secret = 'postgresql://fixture:percent%password@nonexistent.invalid/postgres'
runtime.private_write(secret_file, "KOL_DATABASE_URL='" + secret + "'\n")
plain = root / 'synthetic.tar.gz'
with tarfile.open(plain, 'w:gz') as tar:
    tar.add(backup, arcname='kol-live-baseline-synthetic')
archive = recovery / 'kol-live-baseline-synthetic.tar.gz.enc'
subprocess.run(['openssl','enc','-aes-256-cbc','-salt','-pbkdf2','-iter','250000','-md','sha256',
    '-in',str(plain),'-out',str(archive),'-pass','stdin'],input=secret+'\n',text=True,check=True)
Path(str(archive)+'.sha256').write_text(hashlib.sha256(archive.read_bytes()).hexdigest()+'  '+archive.name+'\n')
subprocess.run([sys.executable,str(Path(__file__).with_name('kol_persistent_restore.py')),
    '--root',str(root),'--instance',state['instance_id'],'--recovery',str(recovery),
    '--source-secret-file',str(secret_file)],check=True)
result = json.loads((root / 'baseline-restore-proof.json').read_text())
assert result['status'] == 'KOL_PERSISTENT_BASELINE_RESTORED'
assert result['api_stopped'] and not result['production_ready'] and not result['migrations_applied']
assert (root / 'private/live.env').read_bytes() == before
command = runtime.compose_command(root, assets)
services = runtime.run(command + ['ps','--services','--status','running']).stdout.split()
assert services == ['db'], services
try:
    restore.import_backup(runtime, root, assets, state['instance_id'], backup, evidence)
    raise AssertionError('nonempty target was accepted')
except restore.Refuse as error:
    assert 'not empty' in str(error), str(error)
print('KOL PERSISTENT RESTORE CI PASS: baseline/Auth imported, exact identity, nonempty-target refusal, unchanged keys, API remains closed')

#!/usr/bin/env python3
"""Real-source, read-only backup -> owned disposable persistent-stack rehearsal."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from urllib.parse import parse_qsl,urlsplit,urlunsplit,urlencode


def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value

root,assets=Path(sys.argv[1]).resolve(),Path(sys.argv[2]).resolve()
if not str(root).startswith('/tmp/kol-live-ci-'):raise SystemExit('Disposable CI namespace required')
base=Path(__file__).resolve().parent
runtime=module('runtime',base/'kol_live_runtime.py')
restore=module('restore',base/'kol_persistent_restore.py')
migrate=module('migrate',base/'kol_persistent_migrate.py')
url=os.environ.get('KOL_DATABASE_URL','')
parsed=urlsplit(url)
if not parsed.hostname or 'mphruawzozrpwcjgejhs' not in (parsed.username or '')+parsed.hostname:
    raise SystemExit('Expected protected source project secret required')
query=dict(parse_qsl(parsed.query));query['options']='-c default_transaction_read_only=on'
source_url=urlunsplit(parsed._replace(query=urlencode(query)))
# Credentials are scoped to the read-only backup subprocess, not migration.
subprocess.run(['bash',str(base/'backup-live-supabase.sh')],check=True,env={**os.environ,
    'KOL_DATABASE_URL':source_url,'PGOPTIONS':'-c default_transaction_read_only=on','KOL_BACKUP_ROOT':str(root/'source')})
backup,=list((root/'source').glob('kol-live-baseline-*'))
state=json.loads((root/'state.json').read_text())
evidence=root/'source-restore-evidence';evidence.mkdir(mode=0o700)
proof=restore.import_backup(runtime,root,assets,state['instance_id'],backup,evidence)
bundle=root/'releases'/migrate.INFRA_SHA
(bundle/'scripts').mkdir(parents=True)
shutil.copyfile(base/'kol_live_runtime.py',bundle/'scripts/kol_live_runtime.py')
shutil.copytree(assets,bundle/'ops/ubuntu/live')
subprocess.run([sys.executable,str(base/'kol_persistent_migrate.py'),'--root',str(root),
    '--instance',state['instance_id'],'--baseline-sha256',proof['baseline_sha256'],
    '--release-sha',os.environ['GITHUB_SHA'],'--package-path',str(assets/'migration-bundle.json.zlib')],check=True,
    env={key:value for key,value in os.environ.items() if key!='KOL_DATABASE_URL'})
result=json.loads((root/'migration-proof.json').read_text())
assert result['apply_count']==43 and result['verify_count']==72 and result['records_preserved'] and result['api_stopped']
print('KOL PERSISTENT REAL-SOURCE MIGRATION PROOF PASS: 43 APPLY, 72 VERIFY, records preserved, role isolation, source read-only, API closed')

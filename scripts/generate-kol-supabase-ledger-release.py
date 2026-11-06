#!/usr/bin/env python3
"""Build reviewed KOL staging migrations, optionally including verified historical SQL. No database writes."""
import argparse
from datetime import datetime, timedelta
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PLAN=ROOT/'supabase/staging/migration-plan.json'
HISTORY_PINS=ROOT/'ops/ubuntu/live/historical-ledger-sha256.json'
PREACTION='supabase/schema/0090_catalog_media_bucket_PRODUCTION_PREACTION.sql'
ANCHOR='20261106054042'

def inputs():
    plan=json.loads(PLAN.read_text())
    if plan['mode']!='staging-only-reviewed-manual-apply' or len(plan['migrations'])!=44 or sum(len(x['verify']) for x in plan['migrations'])!=74:
        raise ValueError('Staging plan drift; release forbidden')
    steps=[]
    for step in plan['migrations']:
        if step['id']=='009':
            steps.append(('0090',PREACTION))
        steps.append((step['id'],step['apply']))
    if len(steps)!=45:
        raise ValueError('Expected exactly 44 migrations and 009 bucket preaction')
    return plan,steps

def historical_pins():
    pins=json.loads(HISTORY_PINS.read_text())
    if len(pins)!=17 or len({name[:14] for name in pins})!=17:
        raise ValueError('Expected 17 unique historical SQL versions')
    if any(not name.endswith('.sql') or not name[:14].isdigit() or len(sha)!=64 for name,sha in pins.items()):
        raise ValueError('Invalid historical migration fingerprint manifest')
    return pins

def checked_history(history_dir):
    directory=Path(history_dir).resolve()
    expected=historical_pins()
    checked={}
    for name,sha in expected.items():
        path=directory/name
        if path.is_symlink() or not path.is_file():
            raise ValueError('Missing or linked historical SQL: '+name)
        data=path.read_bytes()
        if not data or hashlib.sha256(data).hexdigest()!=sha:
            raise ValueError('Historical SQL integrity failure: '+name)
        checked[name]=data
    return checked

def build(destination, history_dir=None):
    plan,steps=inputs()
    history=checked_history(history_dir) if history_dir else {}
    destination=Path(destination).resolve()
    if destination.is_symlink() or destination.exists():
        raise ValueError('Release destination exists; refusing overwrite')
    if ROOT==destination or ROOT in destination.parents:
        raise ValueError('Refusing to create executable migrations within source repository')
    migrations=destination/'supabase/migrations'
    migrations.mkdir(parents=True,mode=0o700)
    for name,sql in history.items():
        file=migrations/name
        file.write_bytes(sql)
        file.chmod(0o600)
    anchor=datetime.strptime(ANCHOR,'%Y%m%d%H%M%S')
    record=[]
    for offset,(step_id,source) in enumerate(steps):
        text=(ROOT/source).read_bytes()
        if not text or b'\x00' in text:
            raise ValueError('Invalid SQL contents: '+source)
        suffix='0090_bucket_preaction' if step_id=='0090' else step_id
        name=(anchor+timedelta(seconds=offset)).strftime('%Y%m%d%H%M%S')+'_kol_'+suffix+'.sql'
        file=migrations/name
        if file.exists():
            raise ValueError('Migration version collision: '+name)
        file.write_bytes(text)
        file.chmod(0o600)
        record.append({'version':name[:14],'id':step_id,'filename':name,'source':source,'sha256':hashlib.sha256(text).hexdigest()})
    manifest={'plan':'staging-only-reviewed-manual-apply','preexisting_migrations_expected':17,'historical_sql_count':len(history),'new_cli_files':len(record),'reviewed_sql_apply_steps':44,'extra_bucket_preaction_steps':1,'sql_verify_steps':74,'cli_history_compatible':len(history)==17,'writes_permitted':False,'steps':record}
    dest=destination/'release-manifest.json'
    dest.write_text(json.dumps(manifest,indent=2)+'\n')
    dest.chmod(0o600)
    print('KOL_STAGING_RELEASE_GENERATED_PASS new=45 history='+str(len(history))+' verifies=74')
    return manifest

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir',required=True)
    parser.add_argument('--historical-sql-dir',help='Private directory with 17 authentic preexisting migrations (SHA256 pinned)')
    args=parser.parse_args()
    build(args.output_dir,args.historical_sql_dir)

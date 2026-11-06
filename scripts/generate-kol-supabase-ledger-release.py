#!/usr/bin/env python3
"""Prepare only a reviewed, manual KOL Supabase staging release. Never apply SQL."""
import argparse
from datetime import datetime, timedelta
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PLAN=ROOT/'supabase/staging/migration-plan.json'
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

def build(destination):
    plan,steps=inputs()
    destination=Path(destination).resolve()
    if destination.is_symlink() or destination.exists():
        raise ValueError('Release destination exists; refusing overwrite')
    if ROOT==destination or ROOT in destination.parents:
        raise ValueError('Refusing to create executable migrations within source repository')
    migrations=destination/'supabase/migrations'
    migrations.mkdir(parents=True,mode=0o700)
    anchor=datetime.strptime(ANCHOR,'%Y%m%d%H%M%S')
    record=[]
    for offset,(step_id,source) in enumerate(steps):
        text=(ROOT/source).read_bytes()
        if not text or b'\x00' in text:
            raise ValueError('Invalid SQL contents: '+source)
        name=(anchor+timedelta(seconds=offset)).strftime('%Y%m%d%H%M%S')+'_kol_'+step_id+'.sql'
        file=migrations/name
        file.write_bytes(text)
        file.chmod(0o600)
        record.append({'version':name[:14],'id':step_id,'filename':name,'source':source,'sha256':hashlib.sha256(text).hexdigest()})
    manifest={'plan':'staging-only-reviewed-manual-apply','preexisting_migrations_expected':17,'new_cli_files':len(record),'reviewed_sql_apply_steps':44,'extra_bucket_preaction_steps':1,'sql_verify_steps':74,'writes_permitted':False,'steps':record}
    (destination/'release-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    (destination/'release-manifest.json').chmod(0o600)
    print('KOL_STAGING_RELEASE_GENERATED_PASS steps=45 applies=44 verifies=74')
    return manifest

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir',required=True)
    args=parser.parse_args()
    build(args.output_dir)

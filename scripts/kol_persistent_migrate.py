#!/usr/bin/env python3
"""Apply only the reviewed staging package to an identified imported KÖL copy.

No source connection, app cutover, production promotion or automatic retry.
"""
import argparse
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import zlib

INFRA_SHA='07fc1eca55c312815549a83837fbd3fc4839ca23'
BUNDLE_SHA256='302a459b56602180ef8bd52d8ac1c840d266c909b95c4f39328b7aa8a4bd563e'

class Refuse(RuntimeError):
    pass


def load_package(path):
    data=path.read_bytes()
    if hashlib.sha256(data).hexdigest()!=BUNDLE_SHA256:
        raise Refuse('Migration package checksum mismatch')
    package=json.loads(zlib.decompress(data))
    plan=package['plan']
    if len(plan['migrations'])!=43 or sum(len(x['verify']) for x in plan['migrations'])!=72:
        raise Refuse('Reviewed migration/VERIFY counts differ')
    return package


def require_import(proof, instance, baseline_sha):
    if not re.fullmatch('[a-f0-9]{32}',instance) or not re.fullmatch('[a-f0-9]{64}',baseline_sha):
        raise Refuse('A full expected instance and baseline checksum are required')
    if (proof.get('status')!='KOL_PERSISTENT_BASELINE_RESTORED' or proof.get('instance_id')!=instance
        or proof.get('baseline_sha256')!=baseline_sha or proof.get('data_restored') is not True
        or proof.get('migrations_applied') is not False or proof.get('production_ready') is not False):
        raise Refuse('Import proof does not match the expected restored baseline')


def execute_plan(package, sql, provision, progress):
    """Same SQL/order/gates as the completed live-source rehearsal."""
    files,plan=package['files'],package['plan']
    sql(files[plan['preflight']],'preflight')
    sql(package['managed_gate'],'managed-baseline-gate')
    before=sql(package['preserve_sql'],'before-preserved-records')
    applies=verifies=0
    for step in plan['migrations']:
        progress(step['id'],'starting')
        if step['id']=='009':
            provision()
        sql(files[step['apply']],step['id']+'-apply')
        applies+=1
        for i,name in enumerate(step['verify']):
            sql(files[name],step['id']+'-verify-'+str(i+1));verifies+=1
        progress(step['id'],'verified')
        print('Verified migration '+step['id'],flush=True)
    after=sql(package['preserve_sql'],'after-preserved-records')
    if before!=after:
        raise Refuse('Existing user/catalog/operational record hashes changed; API stays closed')
    sql(files[plan['postflight']],'postflight')
    sql(files['supabase/staging/restored_role_isolation_TEST.sql'],'role-isolation-rollback-test')
    # The role test rolls back fixtures; confirm original records again afterward.
    if before!=sql(package['preserve_sql'],'after-role-test-preserved-records'):
        raise Refuse('Role test changed original records; API stays closed')
    sql(package['security_gate'],'final-security-gate')
    return {'apply_count':applies,'verify_count':verifies,'records_preserved':True,'role_isolation_pass':True}


BUCKET_SCRIPT=r"""
(async()=>{
const headers={Authorization:'Bearer '+process.env.SERVICE_KEY,apikey:process.env.SERVICE_KEY,'Content-Type':'application/json'};
const url='http://127.0.0.1:5000/bucket';
const read=async()=>{
 const r=await fetch(url,{headers});
 if(!r.ok)throw Error('Bucket list failed: HTTP '+r.status);
 const buckets=await r.json();
 if(!Array.isArray(buckets))throw Error('Unexpected bucket list response');
 return buckets.find(b=>b.id==='catalog-media');
};
let b=await read();
if(!b){
 const r=await fetch(url,{method:'POST',headers,body:JSON.stringify({id:'catalog-media',name:'catalog-media',public:false,file_size_limit:8388608,allowed_mime_types:['image/jpeg','image/png','image/webp','image/avif']})});
 if(!r.ok)throw Error('Private bucket creation failed: HTTP '+r.status);
 b=await read();
}
if(!b)throw Error('Private bucket missing after creation');
if(b.id!=='catalog-media'||b.name!=='catalog-media'||b.public!==false||Number(b.file_size_limit)!==8388608||JSON.stringify([...b.allowed_mime_types].sort())!==JSON.stringify(['image/jpeg','image/png','image/webp','image/avif'].sort()))throw Error('Private image bucket contract mismatch');
console.log('Private catalog-media bucket contract PASS');
})().catch(e=>{console.error(e.message);process.exit(1)});
"""


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,default=Path.home()/'kol-live')
    parser.add_argument('--instance',required=True)
    parser.add_argument('--baseline-sha256',required=True)
    parser.add_argument('--release-sha',required=True)
    parser.add_argument('--package-path',type=Path)
    args=parser.parse_args()
    if not re.fullmatch('[a-f0-9]{40}',args.release_sha):
        raise Refuse('Full reviewed release SHA required')
    root=args.root.absolute()
    if root.is_symlink():raise Refuse('Runtime root must not be a symbolic link')
    proof_path=root/'baseline-restore-proof.json'
    require_import(json.loads(proof_path.read_text()),args.instance,args.baseline_sha256)
    bundle=root/'releases'/INFRA_SHA
    spec=importlib.util.spec_from_file_location('runtime',bundle/'scripts/kol_live_runtime.py')
    runtime=importlib.util.module_from_spec(spec);spec.loader.exec_module(runtime)
    assets=bundle/'ops/ubuntu/live'
    state,env=runtime.prepare(root,assets,'http://127.0.0.1:54331','http://127.0.0.1:3100')
    if state['instance_id']!=args.instance:raise Refuse('Wrong runtime instance')
    command=runtime.compose_command(root,assets)
    os.umask(0o077)
    with open(root/'private/restore.lock','a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        if (root/'migration-attempt.json').exists() or (root/'migration-proof.json').exists():
            raise Refuse('Migration already attempted; automatic reapply/resume is prohibited')
        evidence=root/('migrations-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime()))
        evidence.mkdir(mode=0o700)
        package_path=args.package_path or evidence/'migration-bundle.json.zlib'
        if not args.package_path:
            runtime.run(['curl','--http1.1','-fsSL','--retry','3','--retry-all-errors','--connect-timeout','15','--max-time','120',
                'https://raw.githubusercontent.com/stvelikiy-star/kol-travel-platform/'+args.release_sha+'/ops/ubuntu/live/migration-bundle.json.zlib',
                '-o',str(package_path)])
        package=load_package(package_path)
        # No user-provided DB URL: every SQL call executes only inside our DB.
        def sql(query,label):
            p=subprocess.run(command+['exec','-T','-e','LC_ALL=C','db','psql','-X','-q','-A','-F','\t','-P','footer=off',
                '-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],input=query,text=True,capture_output=True,
                env={**os.environ,**env})
            (evidence/(label+'.log')).write_text(p.stdout+p.stderr)
            if p.returncode:
                raise Refuse('SQL check failed: '+label+'; private evidence retained; API stays closed')
            return p.stdout
        actual=sql("select project||':'||instance_id from kol_ops.runtime_identity;",'target-identity').strip().splitlines()[-1]
        if actual!='kol-live:'+args.instance:raise Refuse('Database identity mismatch')
        # The acceptance database must remain closed and unchanged since import.
        running=runtime.run(command+['ps','--services','--status','running']).stdout.split()
        if set(running)!={'db'}:raise Refuse('Expected only the imported private database running; no services changed')
        actual_baseline=sql(package['baseline_sql'],'current-imported-baseline')
        if hashlib.sha256(actual_baseline.encode()).hexdigest()!=args.baseline_sha256:
            raise Refuse('Database differs from the accepted imported baseline; no migrations applied')
        sql(package['managed_gate'],'pre-mutation-managed-gate')
        attempt={'instance_id':args.instance,'release_sha':args.release_sha,'bundle_sha256':BUNDLE_SHA256,'phase':'starting','completed':[]}
        runtime.private_write(root/'migration-attempt.json',json.dumps(attempt,indent=2)+'\n')
        def progress(step,phase):
            attempt.update(current_step=step,phase=phase)
            if phase=='verified':attempt['completed'].append(step)
            (root/'migration-attempt.json').write_text(json.dumps(attempt,indent=2)+'\n')
        def provision():
            # Storage API only, on the private container network. Gateway/Auth
            # stay stopped. No direct writes to managed Storage tables.
            try:
                runtime.run(command+['up','-d','--wait','--wait-timeout','240','rest','storage'])
                result=runtime.run(command+['exec','-T','storage','node','-e',BUCKET_SCRIPT])
                (evidence/'storage-bucket-contract.log').write_text(result.stdout)
            finally:
                runtime.run(command+['stop','storage','rest'])
        try:
            checks=execute_plan(package,sql,provision,progress)
        finally:
            # Target stays private and closed even if a SQL/VERIFY step fails.
            runtime.run(command+['stop','gateway','auth','rest','storage'])
        result={'status':'KOL_PERSISTENT_MIGRATIONS_PASS','instance_id':args.instance,'release_sha':args.release_sha,
            **checks,'data_restored':True,'migrations_applied':True,'api_stopped':True,
            'application_switched':False,'production_ready':False}
        runtime.private_write(root/'migration-proof.json',json.dumps(result,indent=2)+'\n')
        (evidence/'result.json').write_text(json.dumps(result,indent=2)+'\n')
        progress('complete','pass')
        print(json.dumps(result,indent=2),flush=True)
        print('Migrations verified. Next: connect the application to this accepted target.')

if __name__=='__main__':
    try:main()
    except (RuntimeError,OSError,ValueError,KeyError,zlib.error) as exc:
        print('STOP: '+str(exc),file=sys.stderr);sys.exit(1)

import importlib.util
import json
import shutil
import subprocess
from pathlib import Path
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('migrate',Path(__file__).with_name('kol_persistent_migrate.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
PACKAGE=Path(__file__).resolve().parent.parent/'ops/ubuntu/live/migration-bundle.json.zlib'

class PermanentMigrationSafety(unittest.TestCase):
    def test_delivery_matches_canonical_sql_and_order(self):
        p=m.load_package(PACKAGE);root=PACKAGE.parents[3]
        for name,sql in p['files'].items():self.assertEqual(sql,(root/name).read_text(),name)
        self.assertEqual(p['plan'],json.loads((root/'supabase/staging/migration-plan.json').read_text()))

    def test_changed_bundle_is_rejected(self):
        with tempfile.TemporaryDirectory() as t:
            path=Path(t)/'bad';path.write_bytes(PACKAGE.read_bytes()+b'x')
            with self.assertRaises(m.Refuse):m.load_package(path)

    def test_all_steps_verifies_roles_and_preservation_execute(self):
        p=m.load_package(PACKAGE);calls=[];provision=[];progress=[]
        def sql(query,label):calls.append(label);return 'unchanged'
        result=m.execute_plan(p,sql,lambda:provision.append(len(calls)),lambda *x:progress.append(x))
        self.assertEqual(result['apply_count'],43);self.assertEqual(result['verify_count'],72)
        self.assertEqual(len(provision),1);self.assertEqual(calls[provision[0]],'009-apply')
        self.assertIn('role-isolation-rollback-test',calls);self.assertEqual(calls[-1],'final-security-gate')
        self.assertEqual(len(progress),86)

    def test_failed_verify_stops_before_next_apply(self):
        p=m.load_package(PACKAGE);calls=[]
        def sql(query,label):
            calls.append(label)
            if label=='005-verify-1':raise m.Refuse('expected failure')
            return 'same'
        with self.assertRaises(m.Refuse):m.execute_plan(p,sql,lambda:None,lambda *x:None)
        self.assertNotIn('005a-apply',calls)

    def test_changed_records_block_final_acceptance(self):
        p=m.load_package(PACKAGE);calls=[]
        def sql(query,label):calls.append(label);return label if 'preserved-records' in label else ''
        with self.assertRaises(m.Refuse):m.execute_plan(p,sql,lambda:None,lambda *x:None)
        self.assertNotIn('final-security-gate',calls)

    @unittest.skipUnless(shutil.which('node'),'Node needed for real provisioning JavaScript')
    def test_storage_uses_list_create_list_and_exact_private_contract(self):
        bucket={'id':'catalog-media','name':'catalog-media','public':False,'file_size_limit':8388608,'allowed_mime_types':['image/jpeg','image/png','image/webp','image/avif']}
        fake="const bucket="+json.dumps(bucket)+";let calls=[];global.fetch=async(url,options)=>{calls.push([url,options.method||'GET']);if(options.method==='POST'){const sent=JSON.parse(options.body);if(JSON.stringify(sent)!==JSON.stringify(bucket))throw Error('wrong create body');return {ok:true,status:200};}return {ok:true,status:200,json:async()=>calls.length===1?[]:[bucket]};};process.on('exit',()=>{if(JSON.stringify(calls.map(x=>x[1]))!==JSON.stringify(['GET','POST','GET'])||calls.some(x=>x[0]!=='http://127.0.0.1:5000/bucket'))process.exitCode=2;});"
        result=subprocess.run(['node','-e',fake+m.BUCKET_SCRIPT],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)

    @unittest.skipUnless(shutil.which('node'),'Node needed for real provisioning JavaScript')
    def test_existing_public_bucket_is_refused_without_update(self):
        fake="global.fetch=async(url,options)=>{if(options.method)throw Error('unexpected mutation');return {ok:true,status:200,json:async()=>[{id:'catalog-media',name:'catalog-media',public:true,file_size_limit:8388608,allowed_mime_types:[]}]};};"
        result=subprocess.run(['node','-e',fake+m.BUCKET_SCRIPT],capture_output=True,text=True)
        self.assertEqual(result.returncode,1);self.assertIn('contract mismatch',result.stderr)

    def test_import_proof_must_match_instance_and_baseline(self):
        proof={'status':'KOL_PERSISTENT_BASELINE_RESTORED','instance_id':'a'*32,'baseline_sha256':'b'*64,'data_restored':True,'migrations_applied':False,'production_ready':False}
        m.require_import(proof,'a'*32,'b'*64)
        for changed in [{'instance_id':'c'*32},{'baseline_sha256':'c'*64},{'production_ready':True},{'migrations_applied':True}]:
            with self.subTest(changed=changed),self.assertRaises(m.Refuse):m.require_import({**proof,**changed},'a'*32,'b'*64)

if __name__=='__main__':unittest.main()

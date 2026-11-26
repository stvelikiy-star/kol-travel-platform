/**
 * Real QA Storage bytes -> encrypted off-target archive -> independent object restore.
 * Never touches Production, existing objects or non-KÖL projects.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { isTrustedKolQaTrigger } from './qa-trusted-trigger.mjs';

const QA_PROJECT='mphruawzozrpwcjgejhs';
const QA_URL='https://'+QA_PROJECT+'.supabase.co';
const runId=process.env.GITHUB_RUN_ID;
const attempt=process.env.GITHUB_RUN_ATTEMPT;
const key=process.env.KOL_QA_SERVICE_ROLE_KEY;
const publicKey=process.env.KOL_QA_PUBLISHABLE_KEY;
function assert(ok,reason){if(!ok)throw new Error(reason)}
assert(process.env.GITHUB_ACTIONS==='true' && process.env.GITHUB_REPOSITORY==='stvelikiy-star/kol-travel-platform',
  'QA GitHub-only guard');
assert(process.env.GITHUB_EVENT_NAME==='pull_request' &&
  process.env.GITHUB_HEAD_REF==='release/kol-unified-qa-candidate-20261125' &&
  isTrustedKolQaTrigger(process.env), 'QA trusted PR #182 only');
assert(/^\d+$/.test(runId||'') && /^\d+$/.test(attempt||''),'QA run IDs required');
assert(process.env.KOL_QA_SUPABASE_URL===QA_URL,'Refusing non-QA Supabase URL');
assert(key && (key.startsWith('eyJ')||key.startsWith('sb_secret_')) && key!==publicKey,
  'Separate QA service credentials required');

const admin=createClient(QA_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
const root='qa-recovery-proof/'+runId+'-'+attempt+'-'+randomUUID();
const dir=mkdtempSync(join(tmpdir(),'kol-storage-restore-'));
const owned=[];
const sha=b=>createHash('sha256').update(b).digest('hex');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR+gAAAAASUVORK5CYII=','base64');
const specs=[
  {bucket:'site-visuals',public:true,tag:'public-cms'},
  {bucket:'catalog-media',public:false,tag:'private-catalog'}
];
let failed=null;
try{
  for(const spec of specs){
    const storage=admin.storage.from(spec.bucket);
    const source=root+'/'+spec.tag+'-source.png';
    const restored=root+'/'+spec.tag+'-restored.png';
    // Own tagged paths only, no overwrites.
    owned.push({storage,bucket:spec.bucket,paths:[source,restored]});
    const {error:uploadErr}=await storage.upload(source,png,{contentType:'image/png',upsert:false});
    assert(!uploadErr,'QA original upload failed: '+spec.bucket+':'+(uploadErr?.message||''));
    const {data:download,error:downloadErr}=await storage.download(source);
    assert(!downloadErr&&download,'QA source download failed: '+spec.bucket);
    const sourceBytes=Buffer.from(await download.arrayBuffer());
    assert(sha(sourceBytes)===sha(png),'QA source checksum mismatch: '+spec.bucket);

    // Store encrypted backup bytes in an isolated runner directory, not Supabase.
    const aesKey=randomBytes(32);
    const iv=randomBytes(12);
    const cipher=createCipheriv('aes-256-gcm',aesKey,iv);
    const encrypted=Buffer.concat([cipher.update(sourceBytes),cipher.final()]);
    const tag=cipher.getAuthTag();
    const archive=join(dir,spec.tag+'.aes256gcm');
    writeFileSync(archive,Buffer.concat([iv,tag,encrypted]),{mode:0o600});
    const stored=readFileSync(archive);
    assert(!stored.equals(sourceBytes),'QA backup unexpectedly unencrypted');
    const decipher=createDecipheriv('aes-256-gcm',aesKey,stored.subarray(0,12));
    decipher.setAuthTag(stored.subarray(12,28));
    const extracted=Buffer.concat([decipher.update(stored.subarray(28)),decipher.final()]);
    assert(sha(extracted)===sha(sourceBytes),'QA decrypted backup checksum mismatch');

    const {error:restoreErr}=await storage.upload(restored,extracted,{contentType:'image/png',upsert:false});
    assert(!restoreErr,'QA restored Storage object upload failed: '+spec.bucket+':'+(restoreErr?.message||''));
    const {data:verified,error:readErr}=await storage.download(restored);
    assert(!readErr&&verified,'QA restored Storage read failed: '+spec.bucket);
    const actual=Buffer.from(await verified.arrayBuffer());
    assert(sha(actual)===sha(sourceBytes)&&actual.length===sourceBytes.length,
      'QA restored object hash differs: '+spec.bucket);
    console.log('KOL_QA_STORAGE_BYTE_RESTORE_PASS',spec.bucket,
      spec.public?'public':'private','sha256_verified','aes-256-gcm_off_target','original_and_restore');
  }
}catch(e){
  failed=e;
  console.error('KOL_QA_STORAGE_BYTE_RESTORE_FAIL',String(e.message||e).slice(0,260));
}finally{
  const cleanupProblems=[];
  for(const item of owned){
    const {error}=await item.storage.remove(item.paths);
    if(error)cleanupProblems.push(item.bucket+':'+(error.message||'remove'));
    const {data:list,error:listError}=await item.storage.list(root,{limit:20});
    if(listError || (list||[]).some(x=>item.paths.some(p=>p.endsWith('/'+x.name)))){
      cleanupProblems.push(item.bucket+':scoped_objects_remain');
    }
  }
  rmSync(dir,{recursive:true,force:true});
  if(cleanupProblems.length)failed=failed||new Error('QA scoped cleanup failed '+cleanupProblems.join(','));
  if(!cleanupProblems.length)console.log('KOL_QA_STORAGE_CLEANUP_PASS: no owned Storage objects remain');
}
if(failed)throw failed;
console.log('KOL_QA_STORAGE_RESTORE_FINAL_PASS: 2 buckets, SHA256 equality, encrypted runner backup, cleanup');

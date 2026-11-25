/**
 * Isolated QA Storage recovery: upload -> download -> independent byte copy
 * -> remove original -> restore -> verify SHA256 -> delete.
 * This tests actual object bytes, not just storage.objects metadata.
 */
import {createHash,randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {isTrustedKolQaTrigger} from './qa-trusted-trigger.mjs';

const url='https://mphruawzozrpwcjgejhs.supabase.co';
if(process.env.GITHUB_ACTIONS!=='true' ||
   process.env.GITHUB_REPOSITORY!=='stvelikiy-star/kol-travel-platform' ||
   !isTrustedKolQaTrigger(process.env) ||
   process.env.KOL_QA_SUPABASE_URL!==url)
  throw Error('QA_STORAGE_UNTRUSTED_TARGET');
const admin=createClient(url,process.env.KOL_QA_SERVICE_ROLE_KEY,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
const run=process.env.GITHUB_RUN_ID;
const attempt=process.env.GITHUB_RUN_ATTEMPT;
if(!/^\d+$/.test(run||'')||!/^\d+$/.test(attempt||''))throw Error('QA_STORAGE_RUN_REQUIRED');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlVbG8AAAAASUVORK5CYII=','base64');
const sha=x=>createHash('sha256').update(x).digest('hex');
const id='qa-storage-'+run+'-'+attempt+'-'+randomBytes(6).toString('hex');
const specs=[
 {bucket:'site-visuals',path:id+'/visual.png'},
 {bucket:'catalog-media',path:id+'/catalog.png'}
];
const cleanup=[];
let error=null;
try{
 for(const item of specs){
  const storage=admin.storage.from(item.bucket);
  const {error:uploadError}=await storage.upload(item.path,png,{
   contentType:'image/png',cacheControl:'0',upsert:false});
  if(uploadError)throw Error('QA_STORAGE_UPLOAD_'+item.bucket+':'+uploadError.message);
  cleanup.push(item);
  const {data:source,error:downloadError}=await storage.download(item.path);
  if(downloadError||!source)throw Error('QA_STORAGE_SOURCE_DOWNLOAD_'+item.bucket);
  const offlineCopy=Buffer.from(await source.arrayBuffer());
  if(sha(offlineCopy)!==sha(png))throw Error('QA_STORAGE_SOURCE_CHECKSUM_'+item.bucket);
  const {error:removeError}=await storage.remove([item.path]);
  if(removeError)throw Error('QA_STORAGE_SOURCE_REMOVE_'+item.bucket);
  const {error:restoreError}=await storage.upload(item.path,offlineCopy,{
   contentType:'image/png',cacheControl:'0',upsert:false});
  if(restoreError)throw Error('QA_STORAGE_RESTORE_'+item.bucket);
  const {data:restored,error:restoredError}=await storage.download(item.path);
  if(restoredError||!restored)throw Error('QA_STORAGE_RESTORED_DOWNLOAD_'+item.bucket);
  const finalCopy=Buffer.from(await restored.arrayBuffer());
  if(sha(finalCopy)!==sha(png))throw Error('QA_STORAGE_RESTORED_BYTES_MISMATCH_'+item.bucket);
  console.log('QA_STORAGE_RECOVERY_PASS',item.bucket,'sha256='+sha(png));
 }
}catch(e){error=e;console.error('QA_STORAGE_RECOVERY_FAIL',String(e?.message||e));}
finally{
 for(const item of cleanup){
  const {error:removeError}=await admin.storage.from(item.bucket).remove([item.path]);
  if(removeError){
    console.error('QA_STORAGE_CLEANUP_FAIL',item.bucket);
    error=error||removeError;
  }
 }
 for(const item of specs){
  const {data,error:listError}=await admin.storage.from(item.bucket).list(id);
  if(listError || data?.some(x=>x.name===item.path.split('/').at(-1))){
    console.error('QA_STORAGE_LEAKED_OBJECT',item.bucket);
    error=error||Error('QA_STORAGE_CLEANUP_INCOMPLETE');
  }
 }
}
if(error)process.exitCode=1;
else console.log('QA_STORAGE_RECOVERY_FINAL_PASS: both QA buckets, byte-identical restored objects, zero leftovers');

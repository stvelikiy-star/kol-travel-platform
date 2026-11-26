/**
 * KÖL Production Storage object byte capture for independently encrypted recovery.
 * This script MUST run only on ephemeral GitHub runner for approved Production DB
 * backup, never uploads/deletes Production objects, never prints names or secrets.
 *
 * Modes: selftest | capture <object-metadata-json> <destination> | verify <destination> | summary <destination>
 */
import {createHash,randomBytes} from "node:crypto";
import {createReadStream,createWriteStream,existsSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,rmSync,statSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {resolve,join} from "node:path";
import {Readable} from "node:stream";
import {pipeline} from "node:stream/promises";

const PROJECT="sggajelagfonzpovnsiz";
const URL="https://"+PROJECT+".supabase.co";
const mode=process.argv[2],secret=process.env.KOL_PRODUCTION_SERVICE_ROLE_KEY;
const h=x=>createHash("sha256").update(x).digest("hex");
function assert(ok,code){if(!ok)throw Error(code);}
function truthyGitHub(){
  assert(process.env.GITHUB_ACTIONS==="true" &&
    process.env.GITHUB_REPOSITORY==="stvelikiy-star/kol-travel-platform","production_storage_github_only");
  const manual=process.env.GITHUB_EVENT_NAME==="workflow_dispatch" &&
    process.env.GITHUB_REF==="refs/heads/release/kol-cloud-production-canary-20261123";
  const automatic=process.env.GITHUB_EVENT_NAME==="schedule" &&
    process.env.GITHUB_REF==="refs/heads/main" &&
    process.env.KOL_PRODUCTION_BACKUP_SCHEDULE_ENABLED==="true";
  assert(manual||automatic,"production_storage_untrusted_trigger");
  assert(!process.env.KOL_PRODUCTION_SUPABASE_URL ||
    process.env.KOL_PRODUCTION_SUPABASE_URL===URL,"production_storage_wrong_project");
}
async function shaFile(p){
  const hash=createHash("sha256");let size=0;
  for await (const chunk of createReadStream(p)){
    size+=chunk.length;
    hash.update(chunk);
  }
  return {sha256:hash.digest("hex"),size};
}
function validEntries(items){
  assert(Array.isArray(items),"storage_metadata_not_array");
  const seen=new Set();
  return items.map(v=>{
    assert(v&&typeof v==="object"&&!Array.isArray(v),"storage_metadata_bad_object");
    const bucket=v.bucket, name=v.name;
    assert(typeof bucket==="string"&&/^[a-z0-9][a-z0-9_-]{0,95}$/.test(bucket),"storage_bad_bucket");
    assert(typeof name==="string"&&name.length>0&&name.length<=1024&&!name.includes("\0"),"storage_bad_object_name");
    assert(v.is_delete_marker!==true,"storage_delete_marker_needs_review");
    const key=bucket+"\0"+name;
    assert(!seen.has(key),"storage_duplicate_object_name");
    seen.add(key);
    return {bucket,name,version:v.version??null,id:v.id??null,updated_at:v.updated_at??null};
  });
}
function readManifest(dir){
  const path=join(dir,"manifest.json");
  const doc=JSON.parse(readFileSync(path,"utf8"));
  assert(doc?.schema==="kol-storage-v1" && doc?.project===PROJECT &&
    Array.isArray(doc.files),"storage_manifest_invalid");
  assert(Number.isInteger(doc.count)&&doc.count===doc.files.length,"storage_manifest_count_invalid");
  return doc;
}
async function verify(dir){
  const manifest=readManifest(dir);
  const expected=new Set(["manifest.json"]);
  let total=0;
  for(const item of manifest.files){
    assert(typeof item.blob==="string"&&/^[a-f0-9]{64}\.blob$/.test(item.blob),"storage_manifest_blob_path");
    assert(typeof item.sha256==="string"&&/^[a-f0-9]{64}$/.test(item.sha256),"storage_manifest_hash_invalid");
    assert(Number.isSafeInteger(item.size)&&item.size>=0,"storage_manifest_size_invalid");
    assert(typeof item.bucket==="string"&&typeof item.name==="string","storage_manifest_source_invalid");
    const dest=join(dir,item.blob);
    assert(existsSync(dest),"storage_backup_missing_blob");
    const actual=await shaFile(dest);
    assert(actual.sha256===item.sha256&&actual.size===item.size,"storage_backup_corrupt_blob");
    expected.add(item.blob);total+=actual.size;
  }
  assert(expected.size===manifest.files.length+1,"storage_manifest_duplicate_blobs");
  for(const file of readdirSync(dir))assert(expected.has(file),"storage_backup_unmanifested_file");
  return {count:manifest.count,bytes:total};
}
async function capture(source,dest){
  truthyGitHub();
  assert(process.argv.length===5,"storage_capture_arguments");
  assert(!existsSync(dest),"storage_output_must_be_new");
  const entries=validEntries(JSON.parse(readFileSync(source,"utf8")));
  if(entries.length){
    assert(secret && (secret.startsWith("eyJ")||secret.startsWith("sb_secret_")) &&
      secret.length>=60,"production_storage_service_role_secret_required");
  }
  mkdirSync(dest,{recursive:false,mode:0o700});
  const rows=[];
  for(const entry of entries){
    const blob=h(entry.bucket+"\0"+entry.name)+".blob";
    const encoded=encodeURIComponent(entry.bucket)+"/"+entry.name.split("/").map(encodeURIComponent).join("/");
    const endpoint=URL+"/storage/v1/object/authenticated/"+encoded;
    const response=await fetch(endpoint,{
      headers:{apikey:secret,Authorization:"Bearer "+secret},
      redirect:"error",signal:AbortSignal.timeout(180000)
    });
    assert(response.ok&&response.body&&response.url.startsWith(URL+"/storage/v1/"),
      "production_storage_download_failed_http_"+response.status);
    const destfile=join(dest,blob);
    await pipeline(Readable.fromWeb(response.body),createWriteStream(destfile,{flags:"wx",mode:0o600}));
    const digest=await shaFile(destfile);
    rows.push({...entry,blob,sha256:digest.sha256,size:digest.size});
  }
  writeFileSync(join(dest,"manifest.json"),
    JSON.stringify({schema:"kol-storage-v1",project:PROJECT,count:rows.length,files:rows},null,2),
    {flag:"wx",mode:0o600});
  const result=await verify(dest);
  console.log("KOL_PRODUCTION_STORAGE_CAPTURE_PASS objects="+result.count+" bytes="+result.bytes);
}
async function selftest(){
  const d=mkdtempSync(join(tmpdir(),"kol-storage-bytes-selftest-"));
  try{
    const b1=randomBytes(128), b2=randomBytes(81);
    const files=[b1,b2].map((b,i)=>{
      const id=h("selftest-object-"+i);
      const blob=id+".blob";
      writeFileSync(join(d,blob),b,{mode:0o600});
      return {bucket:i?"catalog-media":"site-visuals",name:"selftest/"+i,
        blob,sha256:h(b),size:b.length};
    });
    writeFileSync(join(d,"manifest.json"),
      JSON.stringify({schema:"kol-storage-v1",project:PROJECT,count:2,files}));
    const ok=await verify(d);
    assert(ok.count===2&&ok.bytes===209,"storage_selftest_readback_failed");
    writeFileSync(join(d,files[0].blob),Buffer.from("tampered"),{mode:0o600});
    let detected=false;
    try{await verify(d);}catch{detected=true;}
    assert(detected,"storage_selftest_corruption_undetected");
    console.log("KOL_STORAGE_BACKUP_SELFTEST_PASS: bytes, hashes, corrupt-object denial");
  }finally{rmSync(d,{force:true,recursive:true});}
}
try{
  if(mode==="selftest")await selftest();
  else if(mode==="capture")await capture(process.argv[3],process.argv[4]);
  else if(mode==="verify"||mode==="summary"){
    assert(process.argv.length===4,"storage_verify_arguments");
    const result=await verify(process.argv[3]);
    if(mode==="verify")console.log("KOL_STORAGE_OFF_TARGET_VERIFY_PASS objects="+result.count+" bytes="+result.bytes);
    else console.log(result.count+" "+result.bytes);
  } else throw Error("storage_invalid_mode");
}catch(e){console.error("KOL_STORAGE_BACKUP_FAIL",String(e?.message||e).slice(0,200));process.exitCode=1;}

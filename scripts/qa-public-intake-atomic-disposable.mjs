#!/usr/bin/env node
// ONLY disposable local Supabase. Never allow a remote/shared DATABASE_URL.
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const db = process.env.SUPABASE_LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const target = new URL(db);
if (!["127.0.0.1","localhost","[::1]"].includes(target.hostname) ||
    target.port !== "54322" ||
    ["host","hostaddr","service"].some(k=>target.searchParams.has(k))) {
  throw new Error("REFUSED: database must be disposable Supabase on loopback port 54322");
}
const hash=()=>randomBytes(32).toString("hex");
const ip=hash();
const phone=hash();
const fingerprint=hash();
function sqlCall(sql) {
  return new Promise((resolve,reject)=>{
    const child=spawn("psql",[db,"-X","-q","-At","-v","ON_ERROR_STOP=1"],{stdio:["pipe","pipe","pipe"]});
    let output="", err="";
    child.stdout.on("data",b=>output+=b);
    child.stderr.on("data",b=>err+=b);
    child.once("error",reject);
    child.once("close",code=>{
      if(code!==0)return reject(new Error("Disposable DB query rejected: "+err.slice(0,250)));
      try{resolve(JSON.parse(output.trim().split("\n").at(-1)));}catch(e){reject(new Error("Bad JSON from local RPC: "+output.slice(0,250)))}
    });
    child.stdin.end("set role service_role;\n"+sql+"\n");
  });
}
function call(id,ipDigest,phoneDigest,fingerprintDigest=fingerprint){
  const payload=JSON.stringify({request_fingerprint:fingerprintDigest,contact_phone_hash:phoneDigest,contact_ip_hash:ipDigest});
  return sqlCall(`select public.public_intake_create_atomic('${id}'::uuid,'support','Disposable QA request','${payload}'::jsonb,'${fingerprintDigest}','${phoneDigest}','${ipDigest}',null)::text;`);
}
// 10 parallel distinct UUIDs: maximum 4 can be created from the same IP.
const ids=Array.from({length:10},()=>randomUUID());
const outcomes=await Promise.all(ids.map(id=>call(id,ip,phone)));
const accepted=outcomes.filter(x=>x.ok===true);
const denied=outcomes.filter(x=>x.code==="rate_limited");
assert.equal(accepted.length,4,"same-IP atomic budget must accept exactly 4");
assert.equal(denied.length,6,"same-IP atomic budget must reject exactly 6");
const existingId=accepted[0].request_id;
const replay=await call(existingId,ip,phone);
assert.equal(replay.ok,true);
assert.equal(replay.replay,true,"network retry must not add a second row");
const conflict=await call(existingId,ip,phone,hash());
assert.equal(conflict.code,"request_id_conflict");
// A phone change cannot evade the same IP's throttling.
const changedPhone=await call(randomUUID(),ip,hash());
assert.equal(changedPhone.code,"rate_limited");
const invalidHash=await call(randomUUID(),"bad",hash());
assert.equal(invalidHash.code,"validation_error");
let malformedUuidRejected=false;
try{await call("not-a-valid-uuid",hash(),hash());}catch{malformedUuidRejected=true;}
assert.equal(malformedUuidRejected,true);
console.log("DISPOSABLE_INTAKE_ATOMIC_PASS: 10 simultaneous, IP across phones, replay/conflict, invalid UUID");

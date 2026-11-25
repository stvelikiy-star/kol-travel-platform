/**
 * TEST-ONLY KÖL privileged MFA E2E: AAL1 denied, TOTP enrollment,
 * AAL2 access, fresh-session challenge, negative code, safe cleanup.
 * Uses temporary, ownership-tagged Supabase QA Auth identities only.
 */
import {createHmac, randomBytes} from "node:crypto";
import {setTimeout as pause} from "node:timers/promises";
import {createClient} from "@supabase/supabase-js";
import {isTrustedKolQaTrigger} from "./qa-trusted-trigger.mjs";
const {chromium}=await import(process.env.KOL_PLAYWRIGHT_MODULE || "playwright");

const ref="mphruawzozrpwcjgejhs";
const url="https://"+ref+".supabase.co";
const app="http://127.0.0.1:3110";
const key=process.env.KOL_QA_SERVICE_ROLE_KEY;
const publicKey=process.env.KOL_QA_PUBLISHABLE_KEY;
const run=process.env.GITHUB_RUN_ID;
const attempt=process.env.GITHUB_RUN_ATTEMPT;
const tag="kol-totp-qa-20261125";
const prefix="kol-mfa-"+run+"-"+attempt+"-";
const email=prefix+randomBytes(6).toString("hex")+"@kol.test";
const password=randomBytes(26).toString("base64url")+"Aa1!";
function check(value, reason){ if(!value)throw Error(reason); }
check(isTrustedKolQaTrigger(process.env) &&
  process.env.GITHUB_EVENT_NAME==="pull_request" &&
  process.env.GITHUB_HEAD_REF==="release/kol-unified-qa-candidate-20261125" &&
  /^\d+$/.test(run||"") && /^\d+$/.test(attempt||"") &&
  process.env.KOL_QA_SUPABASE_URL===url &&
  process.env.NEXT_PUBLIC_SUPABASE_URL===url &&
  key && publicKey && key!==publicKey,
  "QA MFA trusted trigger and isolated credentials required");
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
let id=null,browser=null,failed=null;

function decodeBase32(secret){
  const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes=[];let acc=0,bits=0;
  for(const ch of secret.replace(/\s|=/g,"").toUpperCase()){
    const v=alphabet.indexOf(ch);
    check(v!==-1,"totp_secret_format_invalid");
    acc=(acc<<5)|v;bits+=5;
    if(bits>=8){bits-=8;bytes.push((acc>>bits)&255);}
  }
  return Buffer.from(bytes);
}
function otp(secret,at=Date.now()){
  const counter=Math.floor(at/30000);
  const buf=Buffer.alloc(8);buf.writeBigUInt64BE(BigInt(counter));
  const hash=createHmac("sha1",decodeBase32(secret)).update(buf).digest();
  const offset=hash[hash.length-1]&15;
  return ((hash.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,"0");
}
async function insert(table,details){
  const {error}=await admin.from(table).insert(details);
  check(!error,"mfa_fixture_"+table+":"+String(error?.code||""));
}
async function clean(table){
  const {error}=await admin.from(table).delete().eq("user_id",id);
  check(!error,"mfa_cleanup_"+table);
}
async function login(context, next){
  const page=await context.newPage();
  await page.goto(app+"/login?next="+encodeURIComponent(next),{waitUntil:"domcontentloaded",timeout:45000});
  const form=page.locator('form:has(input[name="password"])').first();
  await form.locator('input[name="email"]').fill(email);
  await form.locator('input[name="password"]').fill(password);
  await Promise.all([
    page.waitForURL(x=>x.pathname==="/account/mfa",{timeout:25000}),
    form.locator('button[type="submit"]').click()
  ]);
  check(new URL(page.url()).searchParams.get("next")==="/admin","mfa_admin_redirect_scope");
  return page;
}
async function submitTOTP(page,secret){
  await page.locator("#kol-mfa-code").fill(otp(secret));
  await page.getByRole("button",{name:"Подтвердить код"}).click();
  await page.getByText("Второй фактор успешно подтверждён для текущей сессии.").waitFor({timeout:20000});
  check(new URL(page.url()).pathname==="/account/mfa","mfa_setup_must_stay_same_origin");
  await page.locator('a[href="/admin"]').click();
  await page.waitForURL(x=>x.pathname==="/admin",{timeout:20000});
}
try{
  const {data,error}=await admin.auth.admin.createUser({
    email,password,email_confirm:true,
    app_metadata:{kol_qa_tag:tag,kol_qa_cohort:prefix}
  });
  check(!error && data?.user?.id && data.user.email===email,"mfa_auth_fixture_failed");
  id=data.user.id;
  await insert("user_profiles",{
    user_id:id,email,full_name:"Temporary KÖL MFA Test",
    status:"active",metadata:{kol_qa_tag:tag,kol_qa_cohort:prefix}
  });
  await insert("user_roles",{user_id:id,role:"super_admin",is_active:true});
  await insert("admin_profiles",{user_id:id,admin_level:"super_admin",department:"QA MFA"});
  browser=await chromium.launch({headless:true});
  const firstContext=await browser.newContext({viewport:{width:390,height:844}});
  const first=await login(firstContext,"/admin");
  check(new URL(first.url()).pathname==="/account/mfa","mfa_missing_enforcement");
  console.log("KOL_QA_MFA_AAL1_DENIED_PASS: password-only super_admin redirected to MFA");
  await first.getByRole("button",{name:"Подключить TOTP"}).click();
  const qr=first.locator('img[alt="Персональный QR-код для настройки TOTP"]');
  await qr.waitFor({timeout:25000});
  const secret=String(await first.locator("details span.font-mono").textContent()||"").trim();
  check(secret.length>=16 && secret.length<128,"mfa_temporary_totp_secret_missing");
  await submitTOTP(first,secret);
  console.log("KOL_QA_MFA_ENROLL_AAL2_PASS: real Supabase TOTP, private server admin enabled");
  await firstContext.close();
  const freshContext=await browser.newContext({viewport:{width:390,height:844}});
  const fresh=await login(freshContext,"/admin");
  await fresh.getByText("Откройте приложение-аутентификатор").waitFor({timeout:20000});
  // A wrong code must not grant AAL2 or admin access.
  await fresh.locator("#kol-mfa-code").fill("000000");
  await fresh.getByRole("button",{name:"Подтвердить код"}).click();
  await fresh.getByText("Код не подтверждён.").waitFor({timeout:12000});
  await fresh.goto(app+"/admin",{waitUntil:"domcontentloaded",timeout:30000});
  await fresh.waitForURL(x=>x.pathname==="/account/mfa",{timeout:15000});
  console.log("KOL_QA_MFA_BAD_CODE_DENIED_PASS");
  // Do not reuse the same TOTP time step used for initial enrollment.
  const ms=Date.now();
  await pause(30000-ms%30000+1300);
  await submitTOTP(fresh,secret);
  console.log("KOL_QA_MFA_FRESH_LOGIN_PASS: AAL1 -> AAL2 required after a new browser session");
  await freshContext.close();
}catch(e){
  failed=e;console.error("KOL_QA_MFA_E2E_FAIL",String(e?.message||e).slice(0,260));
}finally{
  if(browser)await browser.close().catch(()=>{});
  if(id){
    try{
      const {data:identity,error}=await admin.auth.admin.getUserById(id);
      check(!error && identity?.user?.email===email &&
        identity.user.app_metadata?.kol_qa_tag===tag &&
        identity.user.app_metadata?.kol_qa_cohort===prefix,
        "mfa_cleanup_refuses_unowned_auth_identity");
      await clean("admin_profiles");
      await clean("user_roles");
      await clean("user_profiles");
      const {error:deleteError}=await admin.auth.admin.deleteUser(id);
      check(!deleteError,"mfa_auth_cleanup_failed");
      console.log("KOL_QA_MFA_CLEANUP_PASS: temporary admin, TOTP factors and roles removed");
    }catch(e){
      console.error("KOL_QA_MFA_CLEANUP_FAIL",String(e?.message||e).slice(0,180));
      failed=failed||e;
    }
  }
}
if(failed)process.exitCode=1;
else console.log("KOL_QA_MFA_FINAL_PASS");

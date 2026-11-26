/**
 * KÖL: one-time QA-only invite acceptance, password setup, new-session login.
 * Exercises /auth/invite -> /account/security -> /editor/content on a real
 * Supabase QA Auth identity. No external email, no Production, no saved links.
 */
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { isTrustedKolQaTrigger } from './qa-trusted-trigger.mjs';
const { chromium } = await import(process.env.KOL_PLAYWRIGHT_MODULE || 'playwright');

const QA_REF = 'mphruawzozrpwcjgejhs';
const QA_URL = 'https://' + QA_REF + '.supabase.co';
const APP = 'http://127.0.0.1:3100';
const runId = process.env.GITHUB_RUN_ID;
const attempt = process.env.GITHUB_RUN_ATTEMPT;
const prefix = 'kol-invite-e2e-' + runId + '-' + attempt + '-';
const email = prefix + randomBytes(6).toString('hex') + '@kol.test';
const qaTag = 'kol-invite-first-login-qa-20261125';
const key = process.env.KOL_QA_SERVICE_ROLE_KEY;
const publicKey = process.env.KOL_QA_PUBLISHABLE_KEY;

function check(ok, reason) { if (!ok) throw Error(reason); }
check(process.env.GITHUB_ACTIONS === 'true' &&
      process.env.GITHUB_REPOSITORY === 'stvelikiy-star/kol-travel-platform' &&
      process.env.GITHUB_EVENT_NAME === 'pull_request' &&
      process.env.GITHUB_HEAD_REF === 'release/kol-unified-qa-candidate-20261125' &&
      process.env.GITHUB_ACTOR === 'stvelikiy-star' &&
      isTrustedKolQaTrigger(process.env), 'QA invite first-login trusted GitHub PR required');
check(/^\d+$/.test(runId||'') && /^\d+$/.test(attempt||''), 'QA run identity required');
check(process.env.KOL_QA_SUPABASE_URL === QA_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_URL === QA_URL &&
      key && key !== publicKey && publicKey, 'QA-only Supabase credentials required');
const admin = createClient(QA_URL,key,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
let browser = null;
let uid = null;
let failed = null;

async function insert(table,row) {
  const {error} = await admin.from(table).insert(row);
  check(!error,'qa_invite_insert_failed_'+table+':'+(error?.code||''));
}
async function remove(table) {
  if(!uid) return;
  const {error} = await admin.from(table).delete().eq('user_id',uid);
  if(error) throw Error('qa_invite_cleanup_'+table+':'+(error.code||''));
}
try {
  const {data:link,error:generateError} = await admin.auth.admin.generateLink({
    type:'invite',email,options:{data:{full_name:'Temporary KÖL invitation QA'}}
  });
  check(!generateError && link?.user?.id && link.user.email === email &&
        link?.properties?.hashed_token, 'qa_invite_generate_link_failed');
  uid = link.user.id;
  const {error:tagError} = await admin.auth.admin.updateUserById(uid,{
    app_metadata: {kol_qa_tag:qaTag,kol_qa_cohort:prefix}
  });
  check(!tagError,'qa_invite_scope_tag_failed');
  await insert('user_profiles',{
    user_id:uid,email,full_name:'Temporary KÖL invitation QA',
    status:'active',metadata:{kol_qa_tag:qaTag,kol_qa_cohort:prefix}
  });
  await insert('user_roles',{user_id:uid,role:'content_manager',is_active:true});
  await insert('admin_profiles',{
    user_id:uid,admin_level:'content_manager',department:'QA first invite'
  });
  browser = await chromium.launch({headless:true});
  const invited = await browser.newContext({viewport:{width:390,height:844}});
  const first = await invited.newPage();
  const verifyURL = APP+'/auth/invite?next=%2Feditor%2Fcontent&type=invite&token_hash='+
    encodeURIComponent(link.properties.hashed_token);
  const invitePageErrors = [];
  first.on('pageerror', err => invitePageErrors.push(String(err.message||err).slice(0,160)));
  const inviteResponse = await first.goto(verifyURL,{waitUntil:'domcontentloaded',timeout:45000});
  check(inviteResponse?.status()===200,'qa_invite_landing_http_'+inviteResponse?.status());
  try {
    await first.waitForURL(u=>u.pathname==='/account/security' &&
      u.searchParams.get('staff_invite')==='1',{timeout:15000});
  } catch (error) {
    // Diagnostic is credential-free: never write the URL query, link or cookies to CI.
    const reached = new URL(first.url());
    const alert = await first.locator('[role="alert"]').allTextContents().catch(()=>[]);
    const status = await first.locator('[role="status"]').allTextContents().catch(()=>[]);
    console.error('KOL_QA_INVITE_REDIRECT_DIAGNOSTIC',JSON.stringify({
      pathname:reached.pathname,
      hasInviteFlag:reached.searchParams.get('staff_invite')==='1',
      hasTokenQuery:reached.searchParams.has('token_hash'),
      alert:alert.map(x=>x.slice(0,180)),
      status:status.map(x=>x.slice(0,180)),
      pageErrors:invitePageErrors
    }));
    throw error;
  }
  console.log('KOL_QA_INVITE_LINK_REDEEMED_PASS');
  const password = randomBytes(29).toString('base64url') + 'Aa1!';
  const form = first.locator('form:has(input[name="password_confirm"])').first();
  check(await form.count()===1,'qa_invite_password_form_missing');
  await form.locator('input[name="password"]').fill(password);
  await form.locator('input[name="password_confirm"]').fill(password);
  try {
    await Promise.all([
      first.waitForURL(u=>u.pathname==='/account/security' &&
        u.searchParams.get('result')==='password_updated',{timeout:15000}),
      form.locator('button[type="submit"]').click()
    ]);
  } catch (error) {
    const reached = new URL(first.url());
    console.error('KOL_QA_INVITE_PASSWORD_DIAGNOSTIC',JSON.stringify({
      pathname:reached.pathname,result:reached.searchParams.get('result'),
      alert:(await first.locator('[role="alert"]').allTextContents().catch(()=>[])).map(x=>x.slice(0,180))
    }));
    throw error;
  }
  console.log('KOL_QA_INVITE_PASSWORD_SET_PASS: real invite token, confirmed identity, server-side password update');
  await invited.close();
  // New isolated browser context: no cookies or cached access/refresh token.
  const repeat = await browser.newContext({viewport:{width:390,height:844}});
  const again = await repeat.newPage();
  await again.goto(APP+'/login?next=%2Feditor%2Fcontent',
    {waitUntil:'domcontentloaded',timeout:45000});
  const login = again.locator('form:has(input[name="password"])').first();
  await login.locator('input[name="email"]').fill(email);
  await login.locator('input[name="password"]').fill(password);
  try {
    await Promise.all([
      again.waitForURL(u=>u.pathname==='/editor/content',{timeout:15000}),
      login.locator('button[type="submit"]').click()
    ]);
  } catch(error) {
    const reached = new URL(again.url());
    console.error('KOL_QA_INVITE_FRESH_LOGIN_DIAGNOSTIC',JSON.stringify({
      pathname:reached.pathname,errorCode:reached.searchParams.get('error'),
      alerts:(await again.locator('[role="alert"]').allTextContents().catch(()=>[])).map(x=>x.slice(0,160))
    }));
    throw error;
  }
  check(new URL(again.url()).pathname==='/editor/content',
    'qa_invite_new_session_role_redirect_failed');
  await again.goto(APP+'/admin',{waitUntil:'domcontentloaded',timeout:45000});
  check(new URL(again.url()).pathname==='/not-authorized',
    'qa_invite_content_editor_escalated_to_admin');
  console.log('KOL_QA_INVITE_FRESH_LOGIN_PASS: first-password sign-in from new browser; editor allowed, admin denied');
  await repeat.close();
}catch(e){
  failed=e;console.error('KOL_QA_INVITE_FIRST_LOGIN_FAIL',String(e?.message||e).slice(0,220));
}finally{
  if(browser)await browser.close().catch(()=>{});
  if(uid){
    try {
      const {data:current,error:getError}=await admin.auth.admin.getUserById(uid);
      check(!getError &&
        current?.user?.email===email &&
        current?.user?.app_metadata?.kol_qa_tag===qaTag &&
        current?.user?.app_metadata?.kol_qa_cohort===prefix,
        'qa_invite_cleanup_refuses_unowned_identity');
      await remove('admin_profiles');
      await remove('user_roles');
      await remove('user_profiles');
      const {error:deleteError}=await admin.auth.admin.deleteUser(uid);
      check(!deleteError,'qa_invite_auth_cleanup_failed');
      const {data:missing,error:confirmError}=await admin.auth.admin.getUserById(uid);
      check((confirmError?.status===404 || confirmError?.code==='user_not_found') && !missing?.user,
        'qa_invite_user_still_exists');
      console.log('KOL_QA_INVITE_FIRST_LOGIN_CLEANUP_PASS: temporary Auth and role removed');
    }catch(e){
      console.error('KOL_QA_INVITE_FIRST_LOGIN_CLEANUP_FAIL',String(e?.message||e).slice(0,200));
      failed=failed||e;
    }
  }
}
if(failed)process.exitCode=1;
else console.log('KOL_QA_INVITE_FIRST_LOGIN_FINAL_PASS');

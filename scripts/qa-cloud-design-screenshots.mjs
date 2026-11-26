/**
 * Only workflow_dispatch on the design branch; real auth to TEST Supabase.
 * No production, no commercial inventory edits, no passwords in logs/artifacts.
 * All QA-created users/profiles/partner records are cleaned in finally.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { isTrustedKolQaTrigger } from './qa-trusted-trigger.mjs';
const { chromium } = await import(process.env.KOL_PLAYWRIGHT_MODULE || 'playwright');

const ref = 'mphruawzozrpwcjgejhs';
const url = 'https://' + ref + '.supabase.co';
const base = 'http://127.0.0.1:3100';
const run = String(process.env.GITHUB_RUN_ID || '');
const attempt = String(process.env.GITHUB_RUN_ATTEMPT || '');
const prefix = 'kol-vqa-' + run + '-' + attempt + '-';
const tag = 'kol-visual-auth-qa-20261122';
const key = process.env.KOL_QA_SERVICE_ROLE_KEY;
const publicKey = process.env.KOL_QA_PUBLISHABLE_KEY;
const errorList = [];
let failure = null;
let browser = null;
let partnerId = null;
const owned = [];

function check(ok, code) { if (!ok) throw Error(code); }
check(process.env.GITHUB_ACTIONS === 'true' &&
  process.env.GITHUB_REPOSITORY === 'stvelikiy-star/kol-travel-platform' &&
  isTrustedKolQaTrigger(process.env) &&
  /^[0-9]+$/.test(run) && /^[0-9]+$/.test(attempt), 'qa_branch_or_run_guard_failed');
check(process.env.KOL_QA_SUPABASE_URL === url &&
  process.env.NEXT_PUBLIC_SUPABASE_URL === url &&
  base.startsWith('http://127.0.0.1:'), 'qa_target_not_test_project');
check(key && publicKey && key !== publicKey && (key.startsWith('sb_secret_') || key.startsWith('eyJ')),
  'qa_keys_missing');
const admin = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const roleSpecs = [
 {label:'admin',role:'support_admin',target:'/admin'},
 {label:'owner',role:'super_admin',target:'/owner'},
 {label:'partner',role:'partner_owner',target:'/partner'},
 {label:'courier',role:'courier',target:'/courier'},
 {label:'client',role:'client',target:'/client'},
 {label:'editor',role:'content_manager',target:'/editor/content'}
];
const routeLists = {
 admin: ['/admin'],
 owner: ['/owner','/admin','/admin/content','/admin/ads','/admin/ranking','/admin/reviews'],
 partner: ['/partner'],
 courier: ['/courier'],
 client: ['/client'],
 editor: ['/editor/content'],
};
const snapshots=[];
const visualFixture = {checked:false,url:null,path:null,ownerId:null,contentId:null};
const output='design-evidence/authenticated';
mkdirSync(output,{recursive:true});
async function baseline() {
  const n={};
  for (const table of ['user_profiles','user_roles','partners','admin_profiles',
                      'partner_profiles','courier_profiles','client_profiles']) {
    const {count,error}=await admin.from(table).select('id',{count:'exact',head:true});
    check(!error && typeof count==='number','qa_baseline_'+table);
    n[table]=count;
  }
  const {data,error}=await admin.auth.admin.listUsers({page:1,perPage:100});
  check(!error && Array.isArray(data?.users),'qa_auth_baseline_read_failed');
  n.auth_users=data.users.length;
  return n;
}
async function insert(table, row) {
  const {error}=await admin.from(table).insert(row);
  check(!error,'qa_insert_'+table+(error?.code?':'+error.code:''));
}
async function remove(table,col,value) {
  const {error}=await admin.from(table).delete().eq(col,value);
  if(error)errorList.push('qa_cleanup_'+table+':'+(error.code||'failure'));
}
async function setup() {
 for(const spec of roleSpecs) {
   const email=prefix+spec.label+'@kol.test';
   const password=randomBytes(22).toString('base64url')+'A1a!';
   const {data,error}=await admin.auth.admin.createUser({
     email,password,email_confirm:true,
     app_metadata:{kol_qa_tag:tag,kol_qa_cohort:prefix}
   });
   check(!error && data?.user?.id,'qa_auth_create_'+spec.label);
   const userId=data.user.id;
   owned.push({...spec,userId,email,password});
   await insert('user_profiles',{
     user_id:userId,email,full_name:'Temporary KÖL visual QA '+spec.label,
     status:'active',metadata:{kol_qa_tag:tag,kol_qa_cohort:prefix}
   });
   await insert('user_roles',{user_id:userId,role:spec.role,is_active:true});
   if(spec.label==='admin'||spec.label==='owner'||spec.label==='editor')await insert('admin_profiles',{
     user_id:userId,admin_level:spec.role,department:'QA visual'});
   if(spec.label==='client')await insert('client_profiles',{user_id:userId});
   if(spec.label==='courier')await insert('courier_profiles',{user_id:userId});
   if(spec.label==='partner'){
      partnerId=randomUUID();
      await insert('partners',{
        id:partnerId,owner_user_id:userId,type:'marketplace',
        title:'Temporary KÖL visual QA (not for sale)',
        slug:prefix+'partner',status:'pending',business_status:'offline',
        metadata:{kol_qa_tag:tag,kol_qa_cohort:prefix}
      });
      await insert('partner_profiles',{user_id:userId,business_id:partnerId});
   }
 }
 console.log('VISUAL_QA_FIXTURES_CREATED: 6 tagged TEST users, no prices or commercial dates');
}
async function cleanup() {
 for(const person of owned){
  if(person.role==='partner_owner') await remove('partner_profiles','user_id',person.userId);
 }
 if(partnerId)await remove('partners','id',partnerId);
 for(const person of owned){
  const profile=(person.role==='super_admin'||person.role==='support_admin'||person.role==='content_manager')?'admin_profiles':
     person.role==='courier'?'courier_profiles':
     person.role==='client'?'client_profiles':null;
  if(profile)await remove(profile,'user_id',person.userId);
  await remove('user_roles','user_id',person.userId);
  await remove('user_profiles','user_id',person.userId);
  try{
    const {data,error}=await admin.auth.admin.getUserById(person.userId);
    if(error?.status===404)continue;
    check(!error && data?.user?.email===person.email &&
      data.user?.app_metadata?.kol_qa_tag===tag &&
      data.user?.app_metadata?.kol_qa_cohort===prefix,'qa_ownership_not_verified');
    const {error:deleteError}=await admin.auth.admin.deleteUser(person.userId);
    check(!deleteError,'qa_user_delete_failure');
  }catch(e){errorList.push(String(e?.message||'qa_delete_failure'))}
 }
}
function safeName(route){return route==='/'?'home':route.replace(/^\//,'').replaceAll('/','-');}
async function photograph(page,route,role,width,locale='ru') {
 await page.setViewportSize({width,height:width===390?844:900});
 const errors=[];
 const onError=e=>errors.push(String(e).slice(0,180));
 page.on('pageerror',onError);
 const res=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:45000});
 if(locale!=='ru'){
   const language=page.locator('[data-language-option="'+locale+'"]:visible').first();
   check(!!(await language.count()),'qa_locale_button_missing_'+locale+':'+role);
   await language.click();
   await page.waitForFunction(lang=>document.documentElement.lang===lang,locale,{timeout:8000});
 }
 await page.waitForTimeout(350);
 const result=await page.evaluate(()=>{
    const vw=document.documentElement.clientWidth;
    const sw=Math.max(document.documentElement.scrollWidth,document.body?.scrollWidth||0);
    return {viewport:vw,scrollWidth:sw,horizontalOverflow:sw>vw+2,
      main:document.querySelector('main')?.textContent?.slice(0,160),
      h1:document.querySelector('h1')?.textContent?.trim()?.slice(0,90)};
 });
 const status=res?.status()||0;
 const file=output+'/'+role+'-'+locale+'-'+width+'-'+safeName(route)+'.png';
 await page.screenshot({path:file,fullPage:true,animations:'disabled',timeout:60000});
 const record={role,locale,route,width,status,overflow:result.horizontalOverflow,scrollWidth:result.scrollWidth,
    h1:result.h1,errors,file};
 snapshots.push(record);
 console.log('VISUAL_QA_SCREEN',role,locale,route,width,status,result.horizontalOverflow?'OVERFLOW':'PASS');
 check(status===200 && !result.horizontalOverflow,'qa_visual_route_'+role+':'+safeName(route)+':'+width);
 check(!(result.main||'').startsWith('Нет доступа') &&
       !/(У этой учётной записи нет прав)/.test(result.main||''),
   'qa_visual_denied_'+role+':'+safeName(route));
 page.off('pageerror',onError);
}
async function exerciseVisualEditor(page, actor) {
  // QA-only: never overwrite existing CMS content or pre-existing images.
  const {data:existing,error:existingError}=await admin.from('site_content')
    .select('id').eq('content_key','home.visual.banner').eq('locale','ru');
  check(!existingError && existing.length===0,'qa_editor_preexisting_content_refused');
  const {data:existingObjects,error:objectsError}=await admin.storage.from('site-visuals').list('banner',{limit:100});
  check(!objectsError && existingObjects.length===0,'qa_editor_preexisting_media_refused');
  visualFixture.checked=true;
  visualFixture.ownerId=actor.userId;
  const form=page.locator('form:has(input[name="kind"][value="banner"])');
  check(await form.count()===1,'qa_editor_upload_form_missing');
  await form.locator('input[type="file"]').setInputFiles({
    name:'kol-test-banner.png',mimeType:'image/png',
    buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAwAAAAGCAIAAAB4jOjWAAAAFUlEQVR4nGPkm9DDQAgwEVQxSBUBAAW7ATY27z5LAAAAAElFTkSuQmCC','base64')
  });
  await Promise.all([
    page.waitForURL(u=>u.pathname==='/admin/content'&&u.searchParams.has('result'),{timeout:45000}),
    form.locator('button[type="submit"]').click()
  ]);
  check(new URL(page.url()).searchParams.get('result')==='uploaded','qa_editor_upload_rejected');
  const {data:drafts,error:draftError}=await admin.from('site_content').select('id,value,version')
    .eq('content_key','home.visual.banner').eq('locale','ru').eq('status','draft');
  check(!draftError && drafts.length===1,'qa_editor_draft_missing');
  const draft=drafts[0];
  visualFixture.url=draft.value;
  visualFixture.contentId=draft.id;
  const match=new URL(draft.value).pathname.match(
    /^\/storage\/v1\/object\/public\/site-visuals\/(banner\/[a-f0-9-]{36}\.png)$/);
  check(!!match,'qa_editor_unexpected_media_url');
  visualFixture.path=match[1];
  const publish=page.locator('form:has(input[name="content_key"][value="home.visual.banner"]):has(button:has-text("Опубликовать изображение"))');
  check(await publish.count()===1,'qa_editor_publish_form_missing');
  await Promise.all([
    page.waitForURL(u=>u.pathname==='/admin/content'&&u.searchParams.get('result')==='published',{timeout:45000}),
    publish.locator('button[type="submit"]').click()
  ]);
  const {data:published,error:pubError}=await admin.from('site_content').select('id,value')
    .eq('content_key','home.visual.banner').eq('locale','ru').eq('status','published');
  check(!pubError && published.length===1 && published[0].value===visualFixture.url,
    'qa_editor_publication_missing');
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForTimeout(450);
  check(await page.locator('img[src*="/site-visuals/banner/"]').count()>0,
    'qa_editor_public_banner_missing');
  console.log('VISUAL_QA_EDITOR_PASS: authenticated upload, draft, publish and public render');
}
async function cleanupVisualEditor() {
  if(!visualFixture.checked)return;
  const key='home.visual.banner';
  if(visualFixture.url) {
    const ownedIds=[];
    for(const table of ['site_content_history','site_content']){
      const {data:rows,error:lookupError}=await admin.from(table).select('id')
        .eq('content_key',key).eq('locale','ru').eq('value',visualFixture.url);
      if(lookupError){errorList.push('qa_editor_lookup_'+table+':'+(lookupError.code||'error'));continue}
      ownedIds.push(...(rows||[]).map(row=>row.id));
      const {error}=await admin.from(table).delete().eq('content_key',key)
        .eq('locale','ru').eq('value',visualFixture.url);
      if(error)errorList.push('qa_editor_cleanup_'+table+':'+(error.code||'error'));
    }
    if(ownedIds.length){
      const {error}=await admin.from('audit_logs').delete()
        .in('entity_id',ownedIds).in('entity_type',['site_content','site_content_history']);
      if(error)errorList.push('qa_editor_cleanup_audit:'+(error.code||'error'));
    }
  }
  let storagePath=visualFixture.path;
  if(!storagePath) {
    const {data, error}=await admin.storage.from('site-visuals').list('banner',{limit:100});
    if(error)errorList.push('qa_editor_cleanup_list:'+(error.message||'error'));
    else if(data?.length===1 && /^[a-f0-9-]{36}\.png$/.test(data[0].name))
      storagePath='banner/'+data[0].name;
  }
  if(storagePath){
    const {error}=await admin.storage.from('site-visuals').remove([storagePath]);
    if(error)errorList.push('qa_editor_cleanup_storage:'+(error.message||'error'));
  }
  console.log('VISUAL_QA_EDITOR_CLEANUP: scoped CMS draft/publication and uploaded test image removed');
}

async function verifyRevokedStaffAccess(page, person) {
  // The test is strictly scoped to two freshly created, owned QA identities.
  check(['client','editor'].includes(person.label) &&
    owned.some(x => x.userId === person.userId && x.email === person.email),
    'qa_revocation_identity_not_owned');
  let roleRevoked=false;
  let profileBlocked=false;
  try {
    const r=await admin.from('user_roles').update({is_active:false})
      .eq('user_id',person.userId).eq('role',person.role).eq('is_active',true)
      .select('user_id');
    check(!r.error&&r.data?.length===1,'qa_revocation_role_failure');
    roleRevoked=true;
    const p=await admin.from('user_profiles').update({status:'blocked'})
      .eq('user_id',person.userId).eq('status','active')
      .select('user_id');
    check(!p.error&&p.data?.length===1,'qa_revocation_profile_failure');
    profileBlocked=true;
    // The browser must keep the original signed-in cookies/JWT.
    await page.goto(base+person.target,{waitUntil:'domcontentloaded',timeout:45000});
    check(new URL(page.url()).pathname==='/account-blocked',
      'qa_blocked_old_jwt_still_allowed_'+person.label);
    console.log('KOL_QA_BLOCKED_OLD_JWT_PASS',person.label);
  } finally {
    if(profileBlocked){
      const p=await admin.from('user_profiles').update({status:'active'})
        .eq('user_id',person.userId).eq('status','blocked').select('user_id');
      check(!p.error&&p.data?.length===1,'qa_reactivation_profile_failed');
    }
    if(roleRevoked){
      const r=await admin.from('user_roles').update({is_active:true})
        .eq('user_id',person.userId).eq('role',person.role).eq('is_active',false)
        .select('user_id');
      check(!r.error&&r.data?.length===1,'qa_reactivation_role_failed');
    }
  }
  await page.goto(base+person.target,{waitUntil:'domcontentloaded',timeout:45000});
  check(new URL(page.url()).pathname===person.target,
    'qa_reactivation_old_jwt_not_restored_'+person.label);
  console.log('KOL_QA_REACTIVATED_JWT_PASS',person.label);
}

async function capture() {
 browser=await chromium.launch({headless:true});
 for(const spec of owned){
  const context=await browser.newContext({viewport:{width:1440,height:900},locale:'ru-RU'});
  const page=await context.newPage();
  const res=await page.goto(base+'/login?next='+encodeURIComponent(spec.target),
    {waitUntil:'domcontentloaded',timeout:45000});
  check(res?.status()===200,'qa_login_page_error_'+spec.label);
  const form=page.locator('form:has(input[name="password"])').first();
  await form.locator('input[name="email"]').fill(spec.email);
  await form.locator('input[name="password"]').fill(spec.password);
  await Promise.all([
    page.waitForURL(u=>u.pathname===spec.target,{timeout:30000}),
    form.locator('button[type="submit"]').click()
  ]);
  check(new URL(page.url()).pathname===spec.target,'qa_login_redirect_failed_'+spec.label);
  console.log('VISUAL_QA_LOGIN_PASS',spec.label);
  for(const route of routeLists[spec.label]){
    await photograph(page,route,spec.label,1440);
    await photograph(page,route,spec.label,390);
  }
  if(spec.label==='owner') {
    await page.goto(base+'/admin/content',{waitUntil:'domcontentloaded',timeout:45000});
    await exerciseVisualEditor(page,spec);
  }
  // Each real signed-in role must preserve its dashboard layout in KY and EN
  // as well as RU. All screenshots are scoped to local TEST browser instances.
  for(const locale of ['ky','en']) {
    await photograph(page,spec.target,spec.label,390,locale);
  }
  if(spec.label==='client'||spec.label==='editor') await verifyRevokedStaffAccess(page,spec);
  // Explicit cross-role denials on real signed-in JWT sessions.
  const denied = spec.label === 'admin' ? '/owner'
    : spec.label === 'owner' ? '/partner'
    : spec.label === 'partner' ? '/owner'
    : '/admin';
  await page.goto(base + denied, {waitUntil:'domcontentloaded',timeout:45000});
  check(new URL(page.url()).pathname === '/not-authorized',
    'qa_cross_role_denial_failed_' + spec.label);
  console.log('VISUAL_QA_DENIAL_PASS',spec.label,denied);
  if (spec.label === 'admin') {
    await page.goto(base + '/admin/content',{waitUntil:'domcontentloaded',timeout:45000});
    check(new URL(page.url()).pathname === '/not-authorized',
      'qa_content_editor_denial_failed_admin');
    console.log('VISUAL_QA_DENIAL_PASS',spec.label,'/admin/content');
  }
  await context.close();
 }
}
let initial=null;
try{
 initial=await baseline();
 await setup();
 await capture();
 console.log('VISUAL_QA_CAPTURE_PASS',snapshots.length,'authenticated screenshots');
}catch(e){
 failure=String(e?.message||e);
 console.error('VISUAL_QA_FAILURE',failure);
}finally{
 if(browser)await browser.close().catch(()=>{});
 try{await cleanupVisualEditor()}catch(e){errorList.push('qa_visual_editor_cleanup:'+String(e?.message||e))}
 await cleanup();
 try{
  if(initial){
    const after=await baseline();
    for(const k of Object.keys(initial))if(initial[k]!==after[k])errorList.push('baseline_count_mismatch:'+k);
  }
 }catch(e){errorList.push('qa_final_count:'+String(e?.message||e))}
 writeFileSync('design-evidence/authenticated-report.json',
   JSON.stringify({workflow:'KOL Authorized Design Screenshots',testProjectRef:ref,
      run,sourceBranch:process.env.GITHUB_REF?.replace('refs/heads/',''),clean:!errorList.length,
      screenshotCount:snapshots.length,results:snapshots,problem:failure,
      cleanupErrors:errorList},null,2)+'\n');
 if(errorList.length)console.error('VISUAL_QA_CLEANUP_FAIL',errorList.join(';'));
 else console.log('VISUAL_QA_CLEANUP_PASS: baseline counts equal');
}
if(failure||errorList.length)process.exitCode=1;
else console.log('VISUAL_QA_FINAL_PASS: authenticated 6 role views, RU/KG/EN screenshots, editor & cleanup');

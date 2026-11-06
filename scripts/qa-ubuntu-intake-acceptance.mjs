import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
const { chromium } = await import(process.env.KOL_PLAYWRIGHT_MODULE || 'playwright');
const app = process.env.KOL_LOCAL_APP_BASE_URL;
const api = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (app !== 'http://127.0.0.1:3101' || api !== 'http://127.0.0.1:54331' || process.env.KOL_ALLOW_PERSISTENT_QA !== 'true') throw Error('Explicit owned Ubuntu staging QA required');
const svc = createClient(api, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false,autoRefreshToken:false}});
const anon = createClient(api, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {auth:{persistSession:false,autoRefreshToken:false}});
const run = randomUUID();
const business = randomUUID();
const name = 'QA KOL '+run;
const phone = '+996700123456';
const description = 'QA order '+run;
const password = 'Kol!'+randomUUID();
const users = [];
let ticket, browser;
function db(sql) { return execFileSync('docker',['exec','-i','kol-live-db-1','psql','-U','postgres','-d','postgres','-X','-At','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim(); }
function q(s) {return "'"+String(s).replaceAll("'","''")+"'";}
function assert(v,m) {if(!v)throw Error(m);}
const tables = db("select tablename from pg_tables where schemaname='public' order by 1").split('\n');
function snapshot() { return db(tables.map(t=>`select '${t}',count(*),md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by md5(row_to_json(t)::text)),'')) from public."${t}" t`).join(';')+';'); }
const before = snapshot();
const userCount = db('select count(*) from auth.users;');
async function login(page,u,route) {
 await page.goto(app+'/login?next='+encodeURIComponent(route));
 await page.locator('form:has(input[name="password"]) input[name="email"]').fill(u.email);
 await page.locator('input[name="password"]').fill(password);
 await Promise.all([page.waitForURL(x=>x.pathname===route,{timeout:20000}),page.locator('form:has(input[name="password"]) button[type="submit"]').click()]);
}
try {
 for(const [key,role] of [['admin','super_admin'],['client','client'],['partner','partner_owner'],['courier','courier']]) {
  const email=`qa-ubuntu-${key}-${run}@kol.test`;
  const {data,error}=await svc.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name:'Ubuntu QA '+key}});
  assert(!error && data.user?.id,'Auth fixture creation failed: '+key);
  const u={key,role,email,id:data.user.id};users.push(u);
  db(`insert into public.user_profiles(user_id,full_name,email,locale,status) values(${q(u.id)},'Ubuntu QA',${q(email)},'ru','active');insert into public.user_roles(user_id,role,is_active) values(${q(u.id)},${q(role)},true);`);
  if(key==='admin')db(`insert into public.admin_profiles(user_id,admin_level) values(${q(u.id)},'super_admin');`);
  if(key==='client')db(`insert into public.client_profiles(user_id) values(${q(u.id)});`);
  if(key==='courier')db(`insert into public.courier_profiles(user_id) values(${q(u.id)});`);
  if(key==='partner')db(`insert into public.partners(id,owner_user_id,type,title,slug,status) values(${q(business)},${q(u.id)},'restaurant','QA temporary partner',${q('qa-'+run)},'pending');insert into public.partner_profiles(user_id,business_id) values(${q(u.id)},${q(business)});insert into public.partner_staff(user_id,business_id,role,permissions,is_active) values(${q(u.id)},${q(business)},'partner_owner','{}',true);`);
 }
 browser=await chromium.launch({headless:true});
 const guest=await browser.newContext();const page=await guest.newPage();
 await page.goto(app+'/checkout');await page.waitForLoadState('networkidle');
 await page.getByPlaceholder('Ваше имя *').fill(name);await page.getByPlaceholder('Телефон *').fill(phone);
 await page.locator('textarea').first().fill(description);
 await page.getByRole('button',{name:'Отправить заявку',exact:true}).click();
 await page.getByText('Заявка принята.',{exact:true}).waitFor({timeout:20000});
 ticket=(await page.locator('span.font-mono').first().innerText()).trim();
 assert(/^[0-9a-f-]{36}$/.test(ticket),'Invalid ticket id');
 assert(db(`select count(*) from support_tickets where id=${q(ticket)} and created_by is null and request_payload->'contact'->>'name'=${q(name)};`)==='1','Ticket persistence mismatch');
 console.log('UBUNTU_ANONYMOUS_INTAKE_PASS');
 const adminCtx=await browser.newContext();const adminPage=await adminCtx.newPage();
 await login(adminPage,users[0],'/admin/support');
 const card=adminPage.locator(`[data-support-ticket="${ticket}"]`);
 const details=card.locator('[data-intake-details]');
 for(const value of [name,phone,description])await details.getByText(value,{exact:true}).waitFor({timeout:10000});
 assert(!(await details.innerText()).includes('contact_phone_hash'),'Internal payload metadata leaked');
 console.log('UBUNTU_OPERATOR_CONTACT_AND_REQUEST_VISIBLE_PASS');
 for(const [status,label] of [['in_progress','Взять в работу'],['resolved','Отметить решённым'],['closed','Закрыть обращение']]) {
  await adminPage.goto(app+'/admin/support');
  const form=adminPage.locator(`[data-support-ticket="${ticket}"]`).getByTestId('admin-support-status-form');
  await form.locator('input[name="reason"]').fill('QA controlled transition '+run);
  await Promise.all([adminPage.waitForURL(x=>x.searchParams.get('adminSupport')==='success',{timeout:20000}),form.getByRole('button',{name:label,exact:true}).click()]);
  assert(db(`select status from support_tickets where id=${q(ticket)};`)===status,'Lifecycle mismatch '+status);
 }
 assert(db(`select count(*) from audit_logs where entity_id=${q(ticket)} and action='admin_support_status_changed';`)==='3','Status audit count mismatch');
 console.log('UBUNTU_OPERATOR_OPEN_TO_CLOSED_AND_AUDIT_PASS');
 await adminPage.goto(app+'/owner');await adminPage.getByRole('heading',{name:'Бизнес KÖL — в одном экране',exact:true}).waitFor();
 console.log('UBUNTU_OWNER_CABINET_PASS');
 for(const [key,route,marker,denied] of [['client','/client','Кабинет клиента','/admin'],['partner','/partner','Кабинет партнёра','/owner'],['courier','/courier','Кабинет курьера','/partner']]) {
  const ctx=await browser.newContext();const p=await ctx.newPage();const u=users.find(x=>x.key===key);
  await login(p,u,route);await p.getByRole('heading',{name:marker,exact:true,level:1}).waitFor();
  await p.reload();await p.getByRole('heading',{name:marker,exact:true,level:1}).waitFor();
  await p.goto(app+denied);await p.waitForURL(x=>x.pathname==='/not-authorized',{timeout:10000});
  await p.goto(app+route);
  await Promise.all([p.waitForURL(x=>x.pathname==='/login',{timeout:15000}),p.getByRole('button',{name:'Выйти',exact:true}).click()]);
  await p.goto(app+route);await p.waitForURL(x=>x.pathname==='/login');
  console.log('UBUNTU_'+key.toUpperCase()+'_LOGIN_RELOAD_DENIAL_LOGOUT_PASS');
  await ctx.close();
 }
 const visible=await anon.from('support_tickets').select('id').eq('id',ticket);
 assert(visible.error || !visible.data?.length,'Anonymous queue visibility');
 console.log('UBUNTU_PRIVATE_QUEUE_DENIED_PASS');
} finally {
 if(browser)await browser.close();
 if(!ticket)ticket=db(`select id from support_tickets where request_payload->'contact'->>'name'=${q(name)};`)||null;
 if(ticket)db(`begin;delete from ticket_messages where ticket_id=${q(ticket)};delete from audit_logs where entity_id=${q(ticket)};delete from support_tickets where id=${q(ticket)} and request_payload->'contact'->>'name'=${q(name)};commit;`);
 db(`delete from public.partners where id=${q(business)} and slug=${q('qa-'+run)};`);
 for(const u of users) {
  const c=createClient(api,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const signed=await c.auth.signInWithPassword({email:u.email,password});
  if(!signed.error)await c.auth.signOut({scope:'global'});
  const removed=await svc.auth.admin.deleteUser(u.id);
  assert(!removed.error,'Temporary Auth user cleanup failed');
 }
 assert(snapshot()===before,'Public data changed after cleanup');
 assert(db('select count(*) from auth.users;')===userCount,'Auth user count changed after cleanup');
 console.log('UBUNTU_QA_CLEANUP_AND_ORIGINAL_PUBLIC_DATA_PRESERVED_PASS');
}

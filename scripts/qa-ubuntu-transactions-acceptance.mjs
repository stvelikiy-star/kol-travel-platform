// Owned Ubuntu staging only. API-created bookings/pickup orders; browser partner/courier operations.
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const { chromium } = await import(process.env.KOL_PLAYWRIGHT_MODULE || 'playwright');
const app = process.env.KOL_LOCAL_APP_BASE_URL;
const api = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (app !== 'http://127.0.0.1:3101' || api !== 'http://127.0.0.1:54331' || process.env.KOL_ALLOW_PERSISTENT_QA !== 'true') throw Error('Explicit owned Ubuntu staging QA required');
process.umask(0o077);
const statePath='/home/agent/kol-live/operations/transaction-qa.json';
if(existsSync(statePath) && JSON.parse(readFileSync(statePath,'utf8')).status==='running')throw Error('Unfinished QA needs cleanup before another run');
const opts={auth:{persistSession:false,autoRefreshToken:false}};
const svc=createClient(api,process.env.SUPABASE_SERVICE_ROLE_KEY,opts);
const publicKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const run=randomUUID(), password='Kol!'+randomUUID();
const ids=Object.fromEntries(['business','stay','room','tour','schedule','menu','deliveryOrder','delivery'].map(k=>[k,randomUUID()]));
const users=[], sessions=[];
let browser;
function db(sql){return execFileSync('docker',['exec','-i','kol-live-db-1','psql','-U','postgres','-d','postgres','-XAt','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}
function q(s){return "'"+String(s).replaceAll("'","''")+"'";}
function assert(ok,message){if(!ok)throw Error(message);}
assert(db("select project||':'||instance_id from kol_ops.runtime_identity;")==='kol-live:e47b84adedb69346a17453033780b8ce','Unexpected target database');
const tables=db("select tablename from pg_tables where schemaname='public' order by 1;").split('\n');
function snapshot(){return db(tables.map(t=>`select '${t}',count(*),md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by md5(row_to_json(t)::text)),'')) from public."${t}" t`).join(';')+';');}
const original=snapshot(), originalUsers=db('select count(*) from auth.users;');
function state(status){writeFileSync(statePath,JSON.stringify({status,run,ids,users:users.map(({id,key})=>({id,key})),original,originalUsers},null,2),{mode:0o600});}
state('running');
async function apiSession(user){const c=createClient(api,publicKey,opts);const {error}=await c.auth.signInWithPassword({email:user.email,password});assert(!error,'Auth sign-in failed for '+user.key);sessions.push(c);return c;}
async function rpc(c,name,args){const {data,error}=await c.rpc(name,args);if(error)throw Error(name+': '+error.message);return data;}
async function login(page,user,route){await page.goto(app+'/login?next='+encodeURIComponent(route));await page.locator('form:has(input[name="password"]) input[name="email"]').fill(user.email);await page.locator('input[name="password"]').fill(password);await Promise.all([page.waitForURL(u=>u.pathname===route,{timeout:20000}),page.locator('form:has(input[name="password"]) button[type="submit"]').click()]);}
async function partnerAction(page,route,label,action){await page.goto(app+route,{waitUntil:'networkidle'});await Promise.all([page.waitForURL(u=>u.searchParams.get('partnerAction')==='success'&&u.searchParams.get('action')===action,{timeout:20000}),page.getByRole('button',{name:label,exact:true}).click()]);}
try{
 for(const [key,role] of [['admin','super_admin'],['client','client'],['partner','partner_owner'],['courier','courier'],['other','client']]){
  const email=`qa-transactions-${key}-${run}@kol.test`;
  const {data,error}=await svc.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name:'KOL transaction QA'}});
  assert(!error&&data.user?.id,'Auth fixture creation failed');
  const u={key,role,email,id:data.user.id};users.push(u);state('running');
  db(`insert into user_profiles(user_id,full_name,email,locale,status) values(${q(u.id)},'QA Transactions',${q(email)},'ru','active');insert into user_roles(user_id,role,is_active) values(${q(u.id)},${q(role)},true);`);
  if(role==='client')db(`insert into client_profiles(user_id) values(${q(u.id)});`);
  if(key==='admin')db(`insert into admin_profiles(user_id,admin_level) values(${q(u.id)},'super_admin');`);
  if(key==='courier')db(`insert into courier_profiles(user_id,availability_status) values(${q(u.id)},'online');`);
 }
 const byKey=Object.fromEntries(users.map(u=>[u.key,u]));
 db(`begin;
 insert into partners(id,owner_user_id,type,title,slug,status,business_status,address) values(${q(ids.business)},${q(byKey.partner.id)},'restaurant','QA transaction fixture',${q('qa-transactions-'+run)},'approved','online','QA pickup only');
 insert into partner_profiles(user_id,business_id) values(${q(byKey.partner.id)},${q(ids.business)});
 insert into partner_staff(user_id,business_id,role,is_active) values(${q(byKey.partner.id)},${q(ids.business)},'partner_owner',true);
 insert into stays(id,business_id,title,slug,status) values(${q(ids.stay)},${q(ids.business)},'QA isolated stay',${q('qa-stay-'+run)},'active');
 insert into rooms(id,stay_id,business_id,title,capacity,price_per_night,status) values(${q(ids.room)},${q(ids.stay)},${q(ids.business)},'QA isolated room',2,1000,'active');
 insert into room_availability(room_id,date,status,available_count,price_override) select ${q(ids.room)}::uuid,current_date+offset_days,'available',2,1100 from generate_series(7,8) offset_days;
 insert into tours(id,business_id,title,slug,price,status) values(${q(ids.tour)},${q(ids.business)},'QA isolated tour',${q('qa-tour-'+run)},300,'active');
 insert into tour_schedules(id,tour_id,date,capacity,booked_count,status) values(${q(ids.schedule)},${q(ids.tour)},current_date+7,4,0,'available');
 insert into restaurants(business_id,min_order_amount,delivery_enabled) values(${q(ids.business)},0,false);
 insert into menu_items(id,business_id,title,price,status) values(${q(ids.menu)},${q(ids.business)},'QA isolated food',750,'active');
 commit;`);
 const [start,end]=db("select (current_date+7)::text||'|'||(current_date+9)::text;").split('|');
 const client=await apiSession(byKey.client),other=await apiSession(byKey.other),courier=await apiSession(byKey.courier);
 const stayArgs={p_room_id:ids.room,p_start_date:start,p_end_date:end,p_guests_count:1,p_idempotency_key:'qa-stay-'+run};
 const stayBooking=await rpc(client,'create_stay_booking_atomic',stayArgs);
 assert(await rpc(client,'create_stay_booking_atomic',stayArgs)===stayBooking,'Stay retry duplicated');
 const conflict=await client.rpc('create_stay_booking_atomic',{...stayArgs,p_guests_count:2});assert(conflict.error,'Changed stay replay accepted');
 assert(db(`select total::text from bookings where id=${q(stayBooking)};`)==='2200.00','Stay price must come from DB');
 assert(db(`select sum(available_count) from room_availability where room_id=${q(ids.room)};`)==='2','Stay replay consumed nights twice');
 const tourArgs={p_tour_schedule_id:ids.schedule,p_participants:2,p_idempotency_key:'qa-tour-'+run};
 const tourBooking=await rpc(client,'create_tour_booking_atomic',tourArgs);
 assert(await rpc(client,'create_tour_booking_atomic',tourArgs)===tourBooking,'Tour replay duplicated');
 assert(db(`select booked_count from tour_schedules where id=${q(ids.schedule)};`)==='2','Tour replay consumed seats twice');
 const foodArgs={p_business_id:ids.business,p_order_type:'food',p_items:[{item_id:ids.menu,qty:2,unit_price:1,total:1}],p_delivery_method:'pickup',p_idempotency_key:'qa-food-'+run};
 const foodOrder=await rpc(client,'create_order_atomic',foodArgs);
 assert(await rpc(client,'create_order_atomic',foodArgs)===foodOrder,'Food replay duplicated');
 assert(db(`select total::text from orders where id=${q(foodOrder)};`)==='1500.00','Order price must come from DB');
 assert(db(`select unit_price::text||':'||total::text from order_items where order_id=${q(foodOrder)};`)==='750.00:1500.00','Forged item prices were trusted');
 const orderConflict=await client.rpc('create_order_atomic',{...foodArgs,p_items:[{item_id:ids.menu,qty:3}]});assert(orderConflict.error,'Changed cart reused request key');
 const tourConflict=await client.rpc('create_tour_booking_atomic',{...tourArgs,p_participants:1});assert(tourConflict.error,'Changed tour reused request key');
 const deliveryDenied=await client.rpc('create_order_atomic',{...foodArgs,p_delivery_method:'delivery',p_idempotency_key:'qa-blocked-'+run});assert(deliveryDenied.error,'Unpriced delivery must remain blocked');
 for(const [table,id]of [['bookings',stayBooking],['orders',foodOrder]]){
  const {data,error}=await other.from(table).select('id').eq('id',id);if(error)assert(error.code==='42501','Unexpected failure cannot prove isolation');else assert(data?.length===0,'Another client read an operation');
 }
 console.log('UBUNTU_AUTH_API_STAY_TOUR_PICKUP_PRICE_IDEMPOTENCY_AND_ISOLATION_PASS');
 browser=await chromium.launch({headless:true});
 const clientContext=await browser.newContext(),clientPage=await clientContext.newPage();
 await login(clientPage,byKey.client,'/client/bookings');
 for(const id of [stayBooking,tourBooking])await clientPage.getByText(id,{exact:false}).first().waitFor({timeout:15000});
 await clientPage.goto(app+'/client/orders');await clientPage.getByText(foodOrder,{exact:false}).first().waitFor();
 console.log('UBUNTU_CLIENT_BROWSER_OPERATION_READBACK_PASS');
 const partnerContext=await browser.newContext(),partnerPage=await partnerContext.newPage();
 await login(partnerPage,byKey.partner,'/partner/bookings');
 for(const [id,type]of [[stayBooking,'stay'],[tourBooking,'tour']]){
  const route='/partner/bookings/'+id;
  await partnerAction(partnerPage,route,'Подтвердить бронь','confirm');
  if(type==='stay')await partnerAction(partnerPage,route,'Отметить прибытие','check_in');
  await partnerAction(partnerPage,route,type==='stay'?'Завершить проживание':'Завершить тур','complete');
  assert(db(`select status||':'||payment_status from bookings where id=${q(id)};`)==='completed:pending','Booking completion changed payment or status incorrectly');
 }
 console.log('UBUNTU_PARTNER_BROWSER_STAY_AND_TOUR_LIFECYCLE_PASS');
 for(const [label,action,status]of [['Принять заказ','accept','accepted_by_partner'],['Начать приготовление','start_preparing','preparing'],['Готов к выдаче','mark_ready','ready_for_pickup']]){
  await partnerAction(partnerPage,'/partner/orders/'+foodOrder,label,action);
  assert(db(`select status||':'||payment_status from orders where id=${q(foodOrder)};`)===status+':pending','Partner order transition mismatch');
 }
 assert(db(`select count(*) from deliveries where order_id=${q(foodOrder)};`)==='0','Pickup invented a courier delivery');
 console.log('UBUNTU_PARTNER_BROWSER_PICKUP_ORDER_LIFECYCLE_PASS');
 // Separate prepared delivery fixture: this does NOT claim public delivery checkout works.
 db(`begin;insert into orders(id,client_id,business_id,type,status,subtotal,delivery_fee,total,payment_status,metadata) values(${q(ids.deliveryOrder)},${q(byKey.client.id)},${q(ids.business)},'food','ready_for_pickup',100,25,125,'pending','{"qa":"prepared-delivery"}');insert into deliveries(id,order_id,status,pickup_address,dropoff_address) values(${q(ids.delivery)},${q(ids.deliveryOrder)},'delivery_pending','QA pickup','QA destination');insert into order_delivery(order_id,delivery_id,delivery_method,pickup_address,dropoff_address) values(${q(ids.deliveryOrder)},${q(ids.delivery)},'delivery','QA pickup','QA destination');commit;`);
 const adminContext=await browser.newContext(),adminPage=await adminContext.newPage();
 await login(adminPage,byKey.admin,'/admin/delivery');
 const select=adminPage.getByLabel('Курьер для доставки '+ids.delivery);
 await select.selectOption(byKey.courier.id);
 await Promise.all([adminPage.waitForURL(u=>u.searchParams.get('assignment')==='success',{timeout:20000}),adminPage.locator('form').filter({has:select}).getByRole('button',{name:'Назначить курьера',exact:true}).click()]);
 assert(db(`select status from deliveries where id=${q(ids.delivery)};`)==='courier_assigned','Assignment did not persist');
 const skip=await courier.rpc('courier_transition_delivery_atomic',{p_delivery_id:ids.delivery,p_to_status:'picked_up',p_reason:'qa-invalid-skip'});assert(skip.error,'Courier skipped a required state');
 const courierContext=await browser.newContext(),courierPage=await courierContext.newPage();
 await login(courierPage,byKey.courier,'/courier/active');
 for(const [status,label]of [['courier_accepted','Принять доставку'],['courier_to_partner','Выехать к партнёру'],['arrived_at_partner','Подтвердить прибытие к партнёру'],['picked_up','Подтвердить получение заказа'],['courier_to_client','Выехать к клиенту'],['arrived_at_client','Подтвердить прибытие к клиенту'],['delivered','Завершить доставку']]){
  await courierPage.getByRole('button',{name:label,exact:true}).click();
  await courierPage.getByRole('status').filter({hasText:'Статус доставки подтверждён сервером: '+(status==='delivered'?'доставлено':status)+'.'}).waitFor({timeout:20000});
  assert(db(`select status from deliveries where id=${q(ids.delivery)};`)===status,'Courier state mismatch');
  assert(db(`select payment_status from orders where id=${q(ids.deliveryOrder)};`)==='pending','Courier changed payment');
 }
 assert(db(`select status from orders where id=${q(ids.deliveryOrder)};`)==='completed','Delivery did not complete order');
 assert(db(`select count(*) from delivery_status_history where delivery_id=${q(ids.delivery)} and changed_by=${q(byKey.courier.id)};`)==='7','Courier history count mismatch');
 assert(db(`select availability_status from courier_profiles where user_id=${q(byKey.courier.id)};`)==='online','Courier availability not released');
 console.log('UBUNTU_PREPARED_DELIVERY_BROWSER_ASSIGNMENT_SEVEN_STATES_PAYMENT_INVARIANT_PASS');
}finally{
 if(browser)await browser.close();
 for(const c of sessions)await c.auth.signOut({scope:'global'});
 const actors=users.length?users.map(u=>q(u.id)).join(','):"'00000000-0000-0000-0000-000000000000'";
 db(`begin;delete from audit_logs where actor_id in (${actors}) or entity_id in(select id from orders where business_id=${q(ids.business)}) or entity_id in(select id from bookings where business_id=${q(ids.business)}) or entity_id=${q(ids.delivery)};
 delete from order_delivery where order_id in(select id from orders where business_id=${q(ids.business)});
 delete from courier_assignments where delivery_id=${q(ids.delivery)};
 delete from delivery_status_history where delivery_id=${q(ids.delivery)};
 delete from deliveries where order_id in(select id from orders where business_id=${q(ids.business)});
 delete from orders where business_id=${q(ids.business)};
 delete from bookings where business_id=${q(ids.business)};
 delete from partners where id=${q(ids.business)} and slug=${q('qa-transactions-'+run)};
 commit;`);
 for(const u of users){const removed=await svc.auth.admin.deleteUser(u.id);assert(!removed.error,'Temporary user cleanup failed');}
 assert(snapshot()===original,'Existing public data changed after cleanup');
 assert(db('select count(*) from auth.users;')===originalUsers,'Auth count changed after cleanup');
 state('cleaned');
 console.log('UBUNTU_TRANSACTION_FIXTURES_REMOVED_ORIGINAL_PUBLIC_DATA_AND_USER_COUNT_PRESERVED_PASS');
}

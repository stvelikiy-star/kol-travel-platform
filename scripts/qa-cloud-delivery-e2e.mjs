/**
 * KÖL cloud SQL/RPC E2E (TEST Supabase ONLY).
 * All money, catalog and courier data are temporary test fixtures, never commercial.
 * Uses REAL signed-in Supabase clients for the operator/partner/courier actions.
 * The initial verified-client intake ticket is seeded by privileged test SQL; web intake UI is NOT covered.
 * No bank requests or real payment execution. Every fixture is removed after execution.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const ref = 'mphruawzozrpwcjgejhs';
const url = 'https://' + ref + '.supabase.co';
const branch = 'refs/heads/release/kol-unified-p0-20261120';
const run = process.env.GITHUB_RUN_ID;
const attempt = process.env.GITHUB_RUN_ATTEMPT;
const token = 'kol-e2e-' + run + '-' + attempt;
const tag = 'kol-cloud-delivery-e2e-v1';
const file = join(process.env.RUNNER_TEMP || '/tmp', token + '.json');
const secret = process.env.KOL_QA_SERVICE_ROLE_KEY;
const publicKey = process.env.KOL_QA_PUBLISHABLE_KEY;
const dbUrl = process.env.KOL_DATABASE_URL;
const mode = process.argv[2];
const specs = [['client','client'],['partner','partner_owner'],['courier','courier'],['admin','super_admin']];
const requireOk = (ok, code) => { if (!ok) throw Error(code); };
requireOk(mode === '--run' || mode === '--cleanup', 'invalid_mode');
requireOk(process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_REPOSITORY === 'stvelikiy-star/kol-travel-platform', 'actions_only');
requireOk(process.env.GITHUB_REF === branch, 'release_ref_required');
requireOk(/^\d+$/.test(run || '') && /^\d+$/.test(attempt || ''), 'run_identity_required');
requireOk(process.env.KOL_QA_SUPABASE_URL === url && dbUrl?.includes(ref), 'test_project_mismatch');
requireOk(secret && publicKey && secret !== publicKey, 'protected_auth_keys_required');

const q = x => "'" + String(x).replaceAll("'", "''") + "'";
function db(sql, label) {
  try {
    return execFileSync('psql', ['-X','-A','-t','-v','ON_ERROR_STOP=1','-c',sql], {
      encoding:'utf8', timeout:30000, maxBuffer:800000,
      env: {...process.env, PGDATABASE: dbUrl, PGCONNECT_TIMEOUT:'10'},
      stdio:['ignore','pipe','pipe']
    }).trim();
  } catch {
    throw Error('qa_sql_failed:' + label);
  }
}
function countSnapshot() {
  return JSON.parse(db("select jsonb_build_object(" + [
    'auth.users','public.user_roles','public.user_profiles','public.partners','public.restaurants',
    'public.menu_items','public.support_tickets','public.orders','public.order_items',
    'public.deliveries','public.delivery_status_history','public.order_status_history',
    'public.courier_profiles','public.courier_assignments','public.audit_logs',
    'private.kol_delivery_tariffs'
  ].map(t => q(t) + ',(select count(*) from ' + t + ')').join(',') + ")::text;", 'baseline_counts'));
}
function freshState(){
  return {
    tag, token, actorIds:{}, businessId:randomUUID(), itemId:randomUUID(),
    ticketId:randomUUID(), orderId:null, deliveryId:null, baseline:null,
  };
}
let state = existsSync(file) ? JSON.parse(readFileSync(file,'utf8')) : freshState();
function save() { writeFileSync(file,JSON.stringify(state),{mode:0o600}); }
requireOk(state.tag === tag && state.token === token, 'state_cohort_mismatch');
const admin = createClient(url, secret, {auth:{persistSession:false,autoRefreshToken:false}});
const sessions = [];
const label = x => 'kol-e2e-' + run + '-' + attempt + '-' + x;
async function identity(id) {
  const {data,error} = await admin.auth.admin.getUserById(id);
  if (error?.status === 404 || error?.code === 'user_not_found') return null;
  if (error) throw Error('auth_scoped_get_failed');
  requireOk(data?.user?.app_metadata?.kol_qa_tag === tag &&
    data.user.app_metadata.kol_qa_cohort === token &&
    data.user.email?.startsWith('kol-e2e-' + run + '-' + attempt + '-'),
    'refusing_non_qa_identity');
  return data.user;
}
function recoverActorIds() {
  // Read-only on auth.users, only the two immutable fixture markers identify users.
  const records = db("select id::text || '|' || split_part(email,'@',1) from auth.users where raw_app_meta_data->>'kol_qa_tag'=" + q(tag) +
    " and raw_app_meta_data->>'kol_qa_cohort'=" + q(token) +
    " and email like " + q('kol-e2e-' + run + '-' + attempt + '-%@kol.test') + ";", 'recover_auth_ids');
  for (const row of records.split('\n').filter(Boolean)) {
    const [id,name] = row.split('|');
    for (const [key] of specs) if (name === label(key)) state.actorIds[key] = id;
  }
  save();
}
async function cleanup(){
  // Recover fixture UUIDs from immutable DB markers if the local runner
  // receipt was lost. This never identifies or mutates non-QA records.
  const recoveredBusiness=db("select id::text from public.partners where slug="+q(token)+" and metadata->>'qa_run'="+q(token)+" limit 1;",'recover_business');
  if (recoveredBusiness) state.businessId=recoveredBusiness;
  const recoveredTicket=db("select id::text from public.support_tickets where request_payload->>'qa_run'="+q(token)+" and category='order_request' limit 1;",'recover_ticket');
  if (recoveredTicket) state.ticketId=recoveredTicket;
  recoverActorIds();
  // End all access to temporary accounts, then remove dependent QA data
  // BEFORE Auth deletion (orders and tariffs use RESTRICT FKs).
  for (const c of sessions) {
    try { await c.auth.signOut({scope:'global'}); } catch { /* cleanup continues */ }
  }
  const ids=Object.values(state.actorIds);
  const actorSql=ids.length ? ids.map(id=>q(id)+'::uuid').join(',') : 'NULL::uuid';
  const partnerId=state.actorIds.partner || '00000000-0000-0000-0000-000000000000';
  const clientId=state.actorIds.client || '00000000-0000-0000-0000-000000000000';
  const businessId=state.businessId;
  const sql = "BEGIN;" +
    "delete from public.audit_logs where actor_id in ("+actorSql+");" +
    "delete from private.kol_delivery_tariffs where business_id="+q(businessId)+"::uuid and zone_code='cholpon-ata';" +
    "delete from public.orders where business_id="+q(businessId)+"::uuid and client_id="+q(clientId)+"::uuid;" +
    "delete from public.support_tickets where id="+q(state.ticketId)+"::uuid and created_by="+q(clientId)+"::uuid and request_payload->>'qa_run'="+q(token)+";" +
    "delete from public.partners where id="+q(businessId)+"::uuid and owner_user_id="+q(partnerId)+"::uuid and slug="+q(token)+";" +
    "COMMIT;";
  db(sql,'cleanup_business_fixtures');
  for (const id of ids) {
    const owned=await identity(id);
    if (!owned) continue;
    const {error}=await admin.auth.admin.deleteUser(id);
    requireOk(!error, 'qa_auth_delete_failed');
    requireOk((await identity(id)) === null, 'qa_auth_delete_unconfirmed');
  }
  recoverActorIds();
  const still = db("select count(*) from auth.users where raw_app_meta_data->>'kol_qa_tag'="+q(tag)+" and raw_app_meta_data->>'kol_qa_cohort'="+q(token)+";",'verify_auth_cleanup');
  requireOk(still==='0', 'qa_auth_orphans');
  if (state.baseline) {
    const after=countSnapshot();
    for (const [table, before] of Object.entries(state.baseline))
      requireOk(after[table]===before, 'qa_baseline_mismatch:'+table);
  }
  if (existsSync(file)) unlinkSync(file);
  console.log('QA_DELIVERY_CLEANUP PASS: all scoped records deleted; baseline reconciled');
}
async function rpc(client, fn, args, label){
  const {data,error}=await client.rpc(fn,args);
  requireOk(!error, 'rpc_failed:'+label+':'+(error?.code||'unknown'));
  requireOk(data?.ok === true || typeof data==='string', 'rpc_result_failed:'+label);
  return data;
}
async function signedClient(who, email, password, uid) {
  const api=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {data,error}=await api.auth.signInWithPassword({email,password});
  requireOk(!error && data?.session?.access_token,'qa_login_failed:'+who);
  sessions.push(api);
  const verified=await api.auth.getUser(data.session.access_token);
  requireOk(!verified.error && verified.data.user.id===uid,'qa_jwt_failed:'+who);
  return api;
}
async function runE2E(){
  requireOk(!Object.keys(state.actorIds).length,'qa_state_not_pristine');
  state.baseline=countSnapshot();
  save();
  const identities={};
  for (const [key,role] of specs) {
    const email=label(key)+'@kol.test';
    const password=randomBytes(28).toString('base64url')+'Ab3!';
    const {data,error}=await admin.auth.admin.createUser({
      email,password,email_confirm:true,
      app_metadata:{kol_qa_tag:tag,kol_qa_cohort:token}
    });
    requireOk(!error&&data?.user?.id,'qa_create_user_failed:'+key);
    state.actorIds[key]=data.user.id;save();
    identities[key]={id:data.user.id,email,password,role};
  }
  const client=identities.client, partner=identities.partner, courier=identities.courier, operator=identities.admin;
  const profileSql=Object.values(identities).map(u=>
    "insert into public.user_profiles(user_id,email,full_name,metadata) values ("+
    q(u.id)+"::uuid,"+q(u.email)+","+q('QA ONLY '+u.role)+
    ",jsonb_build_object('qa_run',"+q(token)+"));" +
    "insert into public.user_roles(user_id,role,is_active) values ("+
    q(u.id)+"::uuid,"+q(u.role)+",true);").join('');
  const partnerSql =
    "insert into public.partners(id,owner_user_id,type,title,slug,address,status,business_status,metadata) values ("+
    q(state.businessId)+"::uuid,"+q(partner.id)+"::uuid,'restaurant','QA ONLY - delivery E2E',"+
    q(token)+",'QA TEST partner address','approved','online',jsonb_build_object('qa_run',"+q(token)+"));" +
    "insert into public.partner_staff(business_id,user_id,role,is_active) values ("+
    q(state.businessId)+"::uuid,"+q(partner.id)+"::uuid,'owner',true);" +
    "insert into public.partner_profiles(user_id,business_id,position) values ("+
    q(partner.id)+"::uuid,"+q(state.businessId)+"::uuid,'QA test owner');" +
    "insert into public.restaurants(business_id,delivery_enabled,min_order_amount) values ("+
    q(state.businessId)+"::uuid,true,0);" +
    "insert into public.menu_items(id,business_id,title,price,status,metadata) values ("+
    q(state.itemId)+"::uuid,"+q(state.businessId)+"::uuid,'QA ONLY - test item',1,'active',jsonb_build_object('qa_run',"+q(token)+"));" +
    "insert into public.courier_profiles(user_id,vehicle_type,availability_status) values ("+
    q(courier.id)+"::uuid,'foot','online');" +
    "insert into private.kol_delivery_tariffs(business_id,zone_code,fee_som,currency,active,valid_from,approved_by,approved_at) values ("+
    q(state.businessId)+"::uuid,'cholpon-ata',1,'KGS',true,now()-interval '1 minute',"+
    q(operator.id)+"::uuid,now());" +
    "insert into public.support_tickets(id,created_by,category,status,title,request_payload) values ("+
    q(state.ticketId)+"::uuid,"+q(client.id)+"::uuid,'order_request','open','QA ONLY - delivery request',"+
    "jsonb_build_object('qa_run',"+q(token)+",'delivery_method','delivery',"+
    "'contact',jsonb_build_object('email',"+q(client.email)+"),"+
    "'cart_items',jsonb_build_array(jsonb_build_object('id',"+q(state.itemId)+",'type','food','quantity',1)),"+
    "'delivery',jsonb_build_object('location','Чолпон-Ата','address','QA ONLY test delivery location 1234')));";
  db('BEGIN;'+profileSql+partnerSql+'COMMIT;','provision_qa_test_only_fixtures');
  console.log('QA_DELIVERY_FIXTURES PASS: isolated verified identities, QA-only tariff and catalog');
  const signed={};
  for (const [key] of specs) signed[key]=await signedClient(key,identities[key].email,identities[key].password,identities[key].id);
  const ownTicket=await signed.client.from('support_tickets').select('id,created_by').eq('id',state.ticketId);
  requireOk(!ownTicket.error && ownTicket.data.length===1 && ownTicket.data[0].created_by===client.id,'client_ticket_read_failed');
  const forbidden=await signed.partner.rpc('admin_confirm_intake_order_atomic',{
    p_ticket_id:state.ticketId,p_business_id:state.businessId,p_confirmed_delivery_fee_som:1,
    p_confirmation_note:'QA unauthorized partner attempt',p_request_id:token+'-denied'
  });
  requireOk(!!forbidden.error,'partner_must_not_confirm_intake');
  const quote=await rpc(signed.admin,'quote_intake_delivery_fee_atomic',{
    p_ticket_id:state.ticketId,p_business_id:state.businessId,p_zone_code:'cholpon-ata'
  },'approved_qa_delivery_quote');
  requireOk(Number(quote.fee_som)===1 && quote.order_created===false,'qa_quote_not_authoritative');
  const params={
    p_ticket_id:state.ticketId,p_business_id:state.businessId,p_confirmed_delivery_fee_som:1,
    p_confirmation_note:'QA ONLY confirmed test delivery',p_request_id:token+'-confirm'
  };
  const confirmed=await rpc(signed.admin,'admin_confirm_intake_order_atomic',params,'admin_confirm_delivery');
  state.orderId=confirmed.order_id;save();
  requireOk(confirmed.idempotent===false&&confirmed.delivery_method==='delivery','qa_order_not_new_delivery');
  const again=await rpc(signed.admin,'admin_confirm_intake_order_atomic',params,'confirm_idempotent_replay');
  requireOk(again.idempotent===true&&again.order_id===state.orderId,'qa_confirm_replay_duplicated');
  const order=await admin.from('orders').select('id,client_id,business_id,payment_status').eq('id',state.orderId).single();
  requireOk(!order.error&&order.data.client_id===client.id&&order.data.payment_status==='pending','qa_order_integrity_failed');
  const d=await admin.from('deliveries').select('id,status').eq('order_id',state.orderId).single();
  requireOk(!d.error&&d.data?.status==='delivery_pending','qa_delivery_aggregate_missing');
  state.deliveryId=d.data.id;save();
  console.log('QA_DELIVERY_INTAKE PASS: verified client request -> admin quote+confirmation; replay idempotent');
  const stranger=await signed.courier.from('orders').select('id').eq('id',state.orderId);
  requireOk(!stranger.error&&stranger.data.length===0,'courier_reads_unassigned_order');
  const unauthorized=await signed.client.rpc('assign_courier_atomic',{p_delivery_id:state.deliveryId,p_courier_id:courier.id});
  requireOk(!!unauthorized.error,'client_can_assign_courier');
  for (const action of ['accept','start_preparing','mark_ready']){
    const status=action==='accept'?'accepted_by_partner':action==='start_preparing'?'preparing':'ready_for_pickup';
    const res=await rpc(signed.partner,'partner_order_action_atomic',{
      p_order_id:state.orderId,p_action:action,p_request_id:token+'-'+action,p_reason:'QA isolated delivery test'
    },'partner_'+action);
    requireOk(res.status===status,'partner_bad_status:'+action);
  }
  const assignment=await rpc(signed.admin,'assign_courier_atomic',{
    p_delivery_id:state.deliveryId,p_courier_id:courier.id,p_reason:'QA E2E test assignment'
  },'admin_courier_assignment');
  requireOk(assignment.status==='courier_assigned','courier_not_assigned');
  const badSkip=await signed.courier.rpc('courier_transition_delivery_atomic',{
    p_delivery_id:state.deliveryId,p_to_status:'picked_up',p_reason:'QA unauthorized status skip'
  });
  requireOk(!!badSkip.error,'courier_invalid_transition_accepted');
  for (const status of ['courier_accepted','courier_to_partner','arrived_at_partner','picked_up','courier_to_client','arrived_at_client','delivered']){
    const result=await rpc(signed.courier,'courier_transition_delivery_atomic',{
      p_delivery_id:state.deliveryId,p_to_status:status,p_reason:'QA lifecycle status'
    },'courier_'+status);
    requireOk(result.status===status,'courier_state_mismatch:'+status);
  }
  const finalD=await admin.from('deliveries').select('status').eq('id',state.deliveryId).single();
  const finalO=await admin.from('orders').select('status,payment_status').eq('id',state.orderId).single();
  requireOk(!finalD.error && finalD.data.status==='delivered','delivery_not_completed');
  requireOk(!finalO.error && finalO.data.status==='completed' && finalO.data.payment_status==='pending','order_not_completed_or_payment_changed');
  const seen=await signed.client.from('orders').select('id,status').eq('id',state.orderId);
  requireOk(!seen.error&&seen.data.length===1&&seen.data[0].status==='completed','client_cannot_see_finished_order');
  console.log('QA_DELIVERY_E2E PASS: client ticket -> admin confirm -> partner prepare -> admin assignment -> courier delivered; no payment claimed');
}
let error=null;
try { if (mode==='--run') await runE2E(); }
catch(e) { error=String(e?.message||'unknown').slice(0,170);console.error('QA_DELIVERY_E2E FAIL: '+error); }
finally {
  try { await cleanup(); }
  catch(e){ console.error('QA_DELIVERY_CLEANUP FAIL: '+String(e?.message||'unknown').slice(0,170));error=error||'qa_cleanup_failed'; }
}
if(error)process.exitCode=1;
else console.log(mode==='--run'?'QA_DELIVERY_FINAL PASS':'QA_DELIVERY_CLEANUP_FINAL PASS');

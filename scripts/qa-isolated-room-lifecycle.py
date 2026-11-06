#!/usr/bin/env python3
"""Isolated KOL room lifecycle integration QA. Every test transaction rolls back."""
import json,subprocess,uuid
# Non-destructive integration QA is allowed ONLY on the dedicated disposable stack.
info=json.loads(subprocess.check_output(['docker','inspect','kol-isolated-44-db-1'],text=True))[0]
assert info['Config']['Labels']['com.docker.compose.project']=='kol-isolated-44', 'Refusing non-isolated DB'
assert any(x.get('HostIp')=='127.0.0.1' for x in info['NetworkSettings']['Ports'].get('5432/tcp',[])), 'Refusing public target DB'
BASE=['docker','exec','-i','kol-isolated-44-db-1','psql','-U','postgres','-d','postgres','-XAt','-v','ON_ERROR_STOP=1']
def run(sql,success=True):
 p=subprocess.run(BASE,input=sql,text=True,capture_output=True,timeout=15)
 if (p.returncode==0)!=success:
  print('FAILED_CASE_DETAIL',(p.stderr or p.stdout)[-600:])
  raise AssertionError('unexpected SQL exit status')
 return p.stdout.strip()
def select(s):
 return run(s+';').splitlines()[-1]
admin=select("select user_id from public.user_roles where role='super_admin' and is_active limit 1")
client=select("select user_id from public.user_roles where role='client' and is_active limit 1")
good=select("select id from public.rooms where status='under_review' and price_per_night>0 and stay_id<>'41000000-0000-0000-0000-000000000001'::uuid order by id limit 1")
bad=select("select id from public.rooms where status='under_review' and price_per_night<=0 order by id limit 1")
demo=select("select id from public.rooms where stay_id='41000000-0000-0000-0000-000000000001'::uuid limit 1")
assert all((admin,client,good,bad,demo))
before=select("select concat((select count(*) from public.audit_logs),':',(select count(*) from public.rooms where status='active'),':',(select count(*) from public.bookings),':',(select count(*) from public.room_availability))")
def session(actor,body):
 return "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','"+actor+"',true);\n"+body+"\nROLLBACK;"
def call(item,action,request):
 return "select public.admin_room_lifecycle_atomic('"+item+"'::uuid,'"+action+"','"+request+"','Verified partner details');"
# Super-admin can read the review queue; a client cannot enumerate rooms.
admin_read=run(session(admin,'select count(*) from public.rooms;'))
client_read=run(session(client,'select count(*) from public.rooms;'))
assert admin_read.splitlines()[-2]=='35',repr(admin_read)
assert client_read.splitlines()[-2]=='0',repr(client_read)
print('CASE_ADMIN_REVIEW_RLS_AND_CLIENT_DENY_PASS')
# A client cannot approve rooms.
run(session(client,call(good,'approve','qa-client-01')),False)
print('CASE_UNAUTHORIZED_CLIENT_DENIED_PASS')
# A demo room stays blocked regardless of its published status.
run(session(admin,call(demo,'unpublish','qa-demo-01')),False)
print('CASE_DEMO_DENIED_PASS')
# A price-zero room cannot even get admin approval.
run(session(admin,call(bad,'approve','qa-badprice-01')),False)
print('CASE_ZERO_PRICE_DENIED_PASS')
# Cannot go directly from under_review to active.
run(session(admin,call(good,'publish','qa-skipapprove-01')),False)
print('CASE_DIRECT_PUBLISH_DENIED_PASS')
# Admin approves then publishes within the same uncommitted test transaction.
code=session(admin,call(good,'approve','qa-approve-'+uuid.uuid4().hex[:12])+"\n"+call(good,'publish','qa-publish-'+uuid.uuid4().hex[:12])+"\nselect status from public.rooms where id='"+good+"'::uuid;")
output=run(code)
assert output.splitlines()[-2]=='active',output[-450:]
entries=[json.loads(x) for x in output.splitlines() if x.startswith('{')]
assert len(entries)==2 and entries[0]['status']=='approved' and entries[1]['status']=='active'
print('CASE_APPROVE_THEN_PUBLISH_PASS')
# Idempotent retry cannot generate a new audit row.
req='qa-repeat-'+uuid.uuid4().hex[:12]
code=session(admin,call(good,'approve',req)+"\n"+call(good,'approve',req)+"\nselect count(*) from public.audit_logs where request_id='"+req+"';")
output=run(code)
assert output.splitlines()[-2]=='1'
records=[json.loads(x) for x in output.splitlines() if x.startswith('{')]
assert records[0]['idempotent'] is False and records[1]['idempotent'] is True
print('CASE_IDEMPOTENT_REPLAY_ONE_AUDIT_PASS')
# Cannot reuse request id for another action.
run(session(admin,call(good,'approve','qa-conflict-01')+"\n"+call(good,'publish','qa-conflict-01')),False)
print('CASE_IDEMPOTENCY_CONFLICT_DENIED_PASS')
after=select("select concat((select count(*) from public.audit_logs),':',(select count(*) from public.rooms where status='active'),':',(select count(*) from public.bookings),':',(select count(*) from public.room_availability))")
assert before==after,(before,after)
print('CASE_ORIGINAL_BOOKINGS_ROOMS_AUDIT_AVAILABILITY_UNCHANGED_PASS')
print('ISOLATED_ROOM_LIFECYCLE_INTEGRATION_PASS cases=9')

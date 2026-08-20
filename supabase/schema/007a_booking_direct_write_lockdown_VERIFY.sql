-- KÖL / 007a verification — READ ONLY

select policyname,roles,cmd,qual,with_check
from pg_policies
where schemaname='public' and tablename='bookings'
order by policyname;
-- Expected: "clients create own bookings" absent.

select grantee,privilege_type
from information_schema.role_table_grants
where table_schema='public'
  and table_name='bookings'
  and grantee in ('anon','authenticated')
  and privilege_type='INSERT'
order by grantee;
-- Expected: zero rows.

select
  has_function_privilege('authenticated','public.create_stay_booking_atomic(uuid,date,date,integer,text)','EXECUTE') as stay_rpc_execute,
  has_function_privilege('authenticated','public.create_tour_booking_atomic(uuid,integer,text)','EXECUTE') as tour_rpc_execute;
-- Expected: true / true after 007.

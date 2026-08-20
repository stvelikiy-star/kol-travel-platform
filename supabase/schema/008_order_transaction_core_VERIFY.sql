-- KÖL / 008 order transaction core verification
-- READ-ONLY. Run after staging apply; do not treat comments as executable tests.

-- 1. Required functions exist.
select
  to_regprocedure('public.create_order_atomic(uuid,text,jsonb,text,text)') as create_order_atomic,
  to_regprocedure('public.mark_order_ready_for_pickup_atomic(uuid)') as mark_ready_atomic;

-- 2. SECURITY DEFINER + fixed search path are visible in catalog metadata.
select
  n.nspname as schema_name,
  p.proname,
  p.prosecdef as security_definer,
  p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('create_order_atomic','mark_order_ready_for_pickup_atomic')
order by p.proname;

-- 3. PUBLIC/anon must not have EXECUTE; authenticated must have EXECUTE.
select
  p.proname,
  has_function_privilege('public', p.oid, 'EXECUTE') as public_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public'
  and p.proname in ('create_order_atomic','mark_order_ready_for_pickup_atomic')
order by p.proname;

-- Expected: public=false, anon=false, authenticated=true.

-- 4. Direct mutation grants on order core must be absent for normal API roles.
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema='public'
  and grantee in ('anon','authenticated')
  and table_name in ('orders','order_items','order_status_history')
  and privilege_type in ('INSERT','UPDATE','DELETE')
order by grantee,table_name,privilege_type;

-- Expected: zero rows.

-- 5. Idempotency index exists.
select indexname,indexdef
from pg_indexes
where schemaname='public'
  and tablename='orders'
  and indexname='uq_orders_client_id_idempotency_key';

-- 6. Old direct insert policy is absent.
select policyname,roles,cmd,qual,with_check
from pg_policies
where schemaname='public'
  and tablename='orders'
order by policyname;

-- Expected: clients create own orders draft absent.

-- 7. Integrity snapshot for staging test runs.
select
  (select count(*) from public.orders) as orders,
  (select count(*) from public.order_items) as order_items,
  (select count(*) from public.order_status_history) as order_history,
  (select count(*) from public.audit_logs where entity_type='orders') as order_audit_logs,
  (select coalesce(sum(stock_qty),0) from public.products where stock_qty is not null) as tracked_product_stock;

-- Manual/concurrent staging scenarios required:
-- A. Shop stock=5, fire concurrent unique order keys totaling >5 qty.
--    committed quantity <=5; stock never negative.
-- B. Retry winning idempotency key: same order id, no second stock decrement.
-- C. Food item price manipulation is impossible because RPC accepts no price/total.
-- D. Foreign-business/inactive item fails and creates no partial rows.
-- E. delivery method other than pickup fails until a DB-authoritative fee model exists.
-- F. Partner A cannot transition partner B order.
-- G. Force audit/history failure in staging transaction and prove order status rolls back.

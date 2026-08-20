-- KÖL / 008a order idempotency payload hardening verification
-- READ-ONLY. Run after staging apply.

-- 1. Wrapper and private internal implementation both exist.
select
  pg_catalog.to_regprocedure('public.create_order_atomic(uuid,text,jsonb,text,text)') as public_wrapper,
  pg_catalog.to_regprocedure('public.create_order_atomic_v1_internal(uuid,text,jsonb,text,text)') as private_internal;

-- 2. Both functions are SECURITY DEFINER with fixed search_path.
select
  n.nspname as schema_name,
  p.proname,
  p.prosecdef as security_definer,
  p.proconfig
from pg_catalog.pg_proc as p
join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('create_order_atomic','create_order_atomic_v1_internal')
order by p.proname;

-- Expected: security_definer=true and proconfig contains search_path="".

-- 3. Only authenticated can execute the public wrapper; the internal 008
-- implementation is not directly executable by normal Data API roles.
select
  p.proname,
  pg_catalog.has_function_privilege('public', p.oid, 'EXECUTE') as public_execute,
  pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_catalog.pg_proc as p
join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('create_order_atomic','create_order_atomic_v1_internal')
order by p.proname;

-- Expected:
-- create_order_atomic: public=false, anon=false, authenticated=true
-- create_order_atomic_v1_internal: all three=false

-- 4. Direct mutation grants on order_delivery must be absent for normal roles.
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'order_delivery'
  and grantee in ('anon','authenticated')
  and privilege_type in ('INSERT','UPDATE','DELETE')
order by grantee, privilege_type;

-- Expected: zero rows.

-- 5. The idempotency uniqueness index from 008 remains present.
select indexname, indexdef
from pg_catalog.pg_indexes
where schemaname = 'public'
  and tablename = 'orders'
  and indexname = 'uq_orders_client_id_idempotency_key';

-- Manual/concurrent staging scenarios required:
-- A. Create shop order key K; retry K with same cart => same id, stock unchanged.
-- B. Retry K with reordered JSON entries => same id.
-- C. Retry K with duplicated rows whose aggregate qty equals original => same id.
-- D. Retry K with changed qty/item/business/type => idempotency_key_payload_conflict.
-- E. Concurrent K with same payload => exactly one order and one stock decrement.
-- F. Concurrent K with different payload => one committed payload; conflicting caller fails.
-- G. Duplicate rows whose normalized quantity exceeds 99 => fail before stock mutation.
-- H. Direct authenticated order_delivery mutation => denied.

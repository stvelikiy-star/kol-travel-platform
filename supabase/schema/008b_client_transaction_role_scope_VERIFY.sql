-- KÖL / client transaction role scope — READ ONLY VERIFY

select
  p.proname,
  p.prosecdef as security_definer,
  coalesce(array_to_string(p.proconfig, ','), '') as function_config,
  has_function_privilege('public', p.oid, 'EXECUTE') as public_can_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc as p
join pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'enforce_active_client_transaction_identity';

select
  event_object_table as table_name,
  trigger_name,
  action_timing,
  event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name in (
    'enforce_active_client_identity_on_bookings',
    'enforce_active_client_identity_on_orders'
  )
order by event_object_table, trigger_name;

-- Expected after 008b:
-- - one SECURITY DEFINER helper with `search_path=` in function_config;
-- - PUBLIC/anon/authenticated cannot EXECUTE the helper directly;
-- - BEFORE INSERT trigger exists on both bookings and orders.

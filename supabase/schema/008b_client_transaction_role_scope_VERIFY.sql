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

-- Machine assertions. This block performs no writes; it only fails the staging
-- smoke when the expected hardening is absent or callable by API roles.
do $$
declare
  v_helper_count integer;
  v_bad_config integer;
  v_bad_acl integer;
  v_trigger_count integer;
begin
  select count(*) into v_helper_count
  from pg_proc as p
  join pg_namespace as n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'enforce_active_client_transaction_identity'
    and p.prosecdef;

  if v_helper_count <> 1 then
    raise exception '008b_verify_helper_missing_or_not_security_definer';
  end if;

  select count(*) into v_bad_config
  from pg_proc as p
  join pg_namespace as n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'enforce_active_client_transaction_identity'
    and not exists (
      select 1
      from unnest(coalesce(p.proconfig, '{}'::text[])) as cfg
      where cfg like 'search_path=%'
    );

  if v_bad_config <> 0 then
    raise exception '008b_verify_search_path_not_fixed';
  end if;

  select count(*) into v_bad_acl
  from pg_proc as p
  join pg_namespace as n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'enforce_active_client_transaction_identity'
    and (
      has_function_privilege('public', p.oid, 'EXECUTE')
      or has_function_privilege('anon', p.oid, 'EXECUTE')
      or has_function_privilege('authenticated', p.oid, 'EXECUTE')
    );

  if v_bad_acl <> 0 then
    raise exception '008b_verify_trigger_helper_api_execute_leak';
  end if;

  select count(*) into v_trigger_count
  from information_schema.triggers
  where trigger_schema = 'public'
    and action_timing = 'BEFORE'
    and event_manipulation = 'INSERT'
    and trigger_name in (
      'enforce_active_client_identity_on_bookings',
      'enforce_active_client_identity_on_orders'
    );

  if v_trigger_count <> 2 then
    raise exception '008b_verify_expected_two_insert_triggers_got_%', v_trigger_count;
  end if;
end
$$;

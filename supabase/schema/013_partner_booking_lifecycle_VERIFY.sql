-- KÖL / partner booking lifecycle verification
-- Read-only verification for 013_partner_booking_lifecycle_DRAFT_NOT_APPLIED.sql.

DO $$
DECLARE
  v_private_definer boolean;
  v_private_fixed_path boolean;
  v_public_definer boolean;
  v_public_fixed_path boolean;
  v_anon_execute boolean;
  v_authenticated_execute boolean;
  v_direct_booking_update boolean;
  v_direct_history_insert boolean;
  v_broad_update_policy integer;
BEGIN
  select p.prosecdef,
         exists (
           select 1
           from unnest(coalesce(p.proconfig, '{}'::text[])) cfg
           where cfg like 'search_path=%'
         )
    into v_private_definer, v_private_fixed_path
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'partner_booking_action_atomic_internal'
    and pg_get_function_identity_arguments(p.oid) = 'p_booking_id uuid, p_action text, p_request_id text, p_reason text';

  if v_private_definer is distinct from true or v_private_fixed_path is distinct from true then
    raise exception 'partner_booking_private_function_security_contract_failed';
  end if;

  select p.prosecdef,
         exists (
           select 1
           from unnest(coalesce(p.proconfig, '{}'::text[])) cfg
           where cfg like 'search_path=%'
         )
    into v_public_definer, v_public_fixed_path
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'partner_booking_action_atomic'
    and pg_get_function_identity_arguments(p.oid) = 'p_booking_id uuid, p_action text, p_request_id text, p_reason text';

  if v_public_definer is distinct from false or v_public_fixed_path is distinct from true then
    raise exception 'partner_booking_public_wrapper_must_be_security_invoker';
  end if;

  select has_function_privilege('anon', 'public.partner_booking_action_atomic(uuid,text,text,text)', 'EXECUTE'),
         has_function_privilege('authenticated', 'public.partner_booking_action_atomic(uuid,text,text,text)', 'EXECUTE')
    into v_anon_execute, v_authenticated_execute;

  if v_anon_execute or not v_authenticated_execute then
    raise exception 'partner_booking_rpc_acl_failed';
  end if;

  select has_table_privilege('authenticated', 'public.bookings', 'UPDATE'),
         has_table_privilege('authenticated', 'public.booking_status_history', 'INSERT')
    into v_direct_booking_update, v_direct_history_insert;

  if v_direct_booking_update or v_direct_history_insert then
    raise exception 'partner_booking_direct_dml_must_remain_closed';
  end if;

  select count(*)
    into v_broad_update_policy
  from pg_policies
  where schemaname = 'public'
    and tablename = 'bookings'
    and policyname = 'partners update own bookings';

  if v_broad_update_policy <> 0 then
    raise exception 'partner_booking_broad_update_policy_still_present';
  end if;
END
$$;

select
  n.nspname as schema_name,
  p.proname,
  p.prosecdef as security_definer,
  p.proconfig,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where (n.nspname, p.proname) in (
  ('private', 'partner_booking_action_atomic_internal'),
  ('public', 'partner_booking_action_atomic')
)
order by n.nspname, p.proname;

select
  has_table_privilege('authenticated', 'public.bookings', 'SELECT') as booking_select,
  has_table_privilege('authenticated', 'public.bookings', 'UPDATE') as booking_update,
  has_table_privilege('authenticated', 'public.booking_status_history', 'INSERT') as history_insert;

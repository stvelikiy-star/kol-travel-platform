-- KÖL / partner availability runtime verification
-- Read-only verification for 014_partner_availability_runtime_DRAFT_NOT_APPLIED.sql.

DO $$
DECLARE
  v_private_definer boolean;
  v_private_fixed_path boolean;
  v_public_definer boolean;
  v_public_fixed_path boolean;
  v_anon_execute boolean;
  v_authenticated_execute boolean;
  v_room_insert boolean;
  v_room_update boolean;
  v_room_delete boolean;
  v_tour_insert boolean;
  v_tour_update boolean;
  v_tour_delete boolean;
  v_broad_room_policy integer;
  v_broad_tour_policy integer;
  v_room_read_policy integer;
  v_tour_read_policy integer;
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
    and p.proname = 'partner_availability_action_atomic_internal'
    and pg_get_function_identity_arguments(p.oid) = 'p_scope_type text, p_scope_id uuid, p_action text, p_request_id text, p_reason text';

  if v_private_definer is distinct from true or v_private_fixed_path is distinct from true then
    raise exception 'partner_availability_private_function_security_contract_failed';
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
    and p.proname = 'partner_availability_action_atomic'
    and pg_get_function_identity_arguments(p.oid) = 'p_scope_type text, p_scope_id uuid, p_action text, p_request_id text, p_reason text';

  if v_public_definer is distinct from false or v_public_fixed_path is distinct from true then
    raise exception 'partner_availability_public_wrapper_must_be_security_invoker';
  end if;

  select has_function_privilege('anon', 'public.partner_availability_action_atomic(text,uuid,text,text,text)', 'EXECUTE'),
         has_function_privilege('authenticated', 'public.partner_availability_action_atomic(text,uuid,text,text,text)', 'EXECUTE')
    into v_anon_execute, v_authenticated_execute;

  if v_anon_execute or not v_authenticated_execute then
    raise exception 'partner_availability_rpc_acl_failed';
  end if;

  select
    has_table_privilege('authenticated', 'public.room_availability', 'INSERT'),
    has_table_privilege('authenticated', 'public.room_availability', 'UPDATE'),
    has_table_privilege('authenticated', 'public.room_availability', 'DELETE'),
    has_table_privilege('authenticated', 'public.tour_schedules', 'INSERT'),
    has_table_privilege('authenticated', 'public.tour_schedules', 'UPDATE'),
    has_table_privilege('authenticated', 'public.tour_schedules', 'DELETE')
  into
    v_room_insert, v_room_update, v_room_delete,
    v_tour_insert, v_tour_update, v_tour_delete;

  if v_room_insert or v_room_update or v_room_delete
     or v_tour_insert or v_tour_update or v_tour_delete then
    raise exception 'partner_availability_direct_dml_must_be_closed';
  end if;

  select count(*) into v_broad_room_policy
  from pg_policies
  where schemaname = 'public'
    and tablename = 'room_availability'
    and policyname = 'partners manage room availability';

  select count(*) into v_broad_tour_policy
  from pg_policies
  where schemaname = 'public'
    and tablename = 'tour_schedules'
    and policyname = 'partners manage tour schedules';

  if v_broad_room_policy <> 0 or v_broad_tour_policy <> 0 then
    raise exception 'partner_availability_broad_policy_still_present';
  end if;

  select count(*) into v_room_read_policy
  from pg_policies
  where schemaname = 'public'
    and tablename = 'room_availability'
    and policyname = 'partners read own room availability'
    and cmd = 'SELECT';

  select count(*) into v_tour_read_policy
  from pg_policies
  where schemaname = 'public'
    and tablename = 'tour_schedules'
    and policyname = 'partners read own tour schedules'
    and cmd = 'SELECT';

  if v_room_read_policy <> 1 or v_tour_read_policy <> 1 then
    raise exception 'partner_availability_scoped_read_policy_missing';
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
  ('private', 'partner_availability_action_atomic_internal'),
  ('public', 'partner_availability_action_atomic')
)
order by n.nspname, p.proname;

select
  has_table_privilege('authenticated', 'public.room_availability', 'SELECT') as room_select,
  has_table_privilege('authenticated', 'public.room_availability', 'UPDATE') as room_update,
  has_table_privilege('authenticated', 'public.tour_schedules', 'SELECT') as tour_select,
  has_table_privilege('authenticated', 'public.tour_schedules', 'UPDATE') as tour_update;

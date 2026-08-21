-- KÖL / kol-travel-platform
-- VERIFY 006e — READ-ONLY / FAIL-CLOSED

DO $$
DECLARE
  v_stay_fn regprocedure := to_regprocedure('public.get_public_stay_inventory(uuid,date,date)');
  v_tour_fn regprocedure := to_regprocedure('public.get_public_tour_schedules(uuid,date,date)');
  v_count integer;
BEGIN
  if v_stay_fn is null then
    raise exception '006e verification failed: get_public_stay_inventory(uuid,date,date) is missing';
  end if;

  if v_tour_fn is null then
    raise exception '006e verification failed: get_public_tour_schedules(uuid,date,date) is missing';
  end if;

  if not has_function_privilege('anon', v_stay_fn, 'EXECUTE')
     or not has_function_privilege('authenticated', v_stay_fn, 'EXECUTE') then
    raise exception '006e verification failed: Stay inventory RPC execute grant is incomplete';
  end if;

  if not has_function_privilege('anon', v_tour_fn, 'EXECUTE')
     or not has_function_privilege('authenticated', v_tour_fn, 'EXECUTE') then
    raise exception '006e verification failed: Tour schedules RPC execute grant is incomplete';
  end if;

  if has_table_privilege('anon', 'public.rooms', 'SELECT')
     or has_table_privilege('anon', 'public.room_availability', 'SELECT')
     or has_table_privilege('anon', 'public.tour_schedules', 'SELECT') then
    raise exception '006e verification failed: anon raw booking-inventory table SELECT must remain denied';
  end if;

  select count(*) into v_count
  from pg_proc as p
  join pg_namespace as n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('get_public_stay_inventory', 'get_public_tour_schedules')
    and (
      p.prosecdef is false
      or not exists (
        select 1
        from unnest(coalesce(p.proconfig, array[]::text[])) as cfg
        where cfg like 'search_path=%'
          and replace(cfg, ' ', '') in ('search_path=""', 'search_path=')
      )
    );

  if v_count <> 0 then
    raise exception '006e verification failed: % public inventory RPC(s) are not SECURITY DEFINER with fixed empty search_path', v_count;
  end if;
END
$$;

select
  p.oid::regprocedure as function_name,
  p.prosecdef as security_definer,
  p.proconfig as function_config,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_proc as p
join pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('get_public_stay_inventory', 'get_public_tour_schedules')
order by p.proname;

select
  table_name,
  has_table_privilege('anon', format('public.%I', table_name), 'SELECT') as anon_select
from (values ('rooms'), ('room_availability'), ('tour_schedules')) as raw(table_name)
order by table_name;

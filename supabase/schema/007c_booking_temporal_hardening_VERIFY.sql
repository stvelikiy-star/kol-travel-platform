-- KÖL / kol-travel-platform
-- VERIFY 007c — READ-ONLY / FAIL-CLOSED

DO $$
DECLARE
  v_stay regprocedure := to_regprocedure('public.create_stay_booking_atomic(uuid,date,date,integer,text)');
  v_tour regprocedure := to_regprocedure('public.create_tour_booking_atomic(uuid,integer,text)');
  v_stay_def text;
  v_tour_def text;
BEGIN
  if v_stay is null or v_tour is null then
    raise exception '007c verification failed: required booking RPC is missing';
  end if;

  if has_function_privilege('anon', v_stay, 'EXECUTE')
     or not has_function_privilege('authenticated', v_stay, 'EXECUTE') then
    raise exception '007c verification failed: Stay booking RPC privilege boundary changed';
  end if;

  if has_function_privilege('anon', v_tour, 'EXECUTE')
     or not has_function_privilege('authenticated', v_tour, 'EXECUTE') then
    raise exception '007c verification failed: Tour booking RPC privilege boundary changed';
  end if;

  select pg_get_functiondef(v_stay) into v_stay_def;
  select pg_get_functiondef(v_tour) into v_tour_def;

  if position('p_start_date < current_date' in lower(v_stay_def)) = 0
     or position('stay_start_date_in_past' in v_stay_def) = 0 then
    raise exception '007c verification failed: Stay past-date guard is missing';
  end if;

  if position('v_schedule_date < current_date' in lower(v_tour_def)) = 0
     or position('tour_schedule_in_past' in v_tour_def) = 0 then
    raise exception '007c verification failed: Tour past-date guard is missing';
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
  and p.proname in ('create_stay_booking_atomic','create_tour_booking_atomic')
order by p.proname;

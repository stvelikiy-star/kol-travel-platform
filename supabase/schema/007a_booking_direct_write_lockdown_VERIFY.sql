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

-- Executable release gate: fail verification instead of relying on a human
-- reading the two diagnostic SELECT result sets above.
DO $verify_booking_direct_insert$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bookings'
      AND policyname = 'clients create own bookings'
  ) THEN
    RAISE EXCEPTION '007a verify failed: direct client booking INSERT policy remains';
  END IF;

  IF has_table_privilege('anon', 'public.bookings', 'INSERT')
     OR has_table_privilege('authenticated', 'public.bookings', 'INSERT')
  THEN
    RAISE EXCEPTION '007a verify failed: API role still has direct booking INSERT';
  END IF;

  IF NOT has_function_privilege(
     'authenticated',
     'public.create_stay_booking_atomic(uuid,date,date,integer,text)',
     'EXECUTE'
  ) OR NOT has_function_privilege(
     'authenticated',
     'public.create_tour_booking_atomic(uuid,integer,text)',
     'EXECUTE'
  ) THEN
    RAISE EXCEPTION '007a verify failed: authenticated booking RPC is not executable';
  END IF;
END
$verify_booking_direct_insert$;

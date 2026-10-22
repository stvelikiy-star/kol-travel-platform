-- KÖL connected Supabase: targeted booking INSERT lockdown proposal.
-- REVIEW ONLY. NOT APPLIED TO THE CONNECTED DATABASE.
-- This differs from staging 007a: the connected DB has the legacy
-- client_stay_booking_create_atomic(...) -> jsonb RPC.
-- Re-run read-only parity / backup / isolated clone E2E before approving.
BEGIN;

DO $guard$
BEGIN
  IF to_regprocedure(
    'public.client_stay_booking_create_atomic(uuid,date,date,integer,text)'
  ) IS NULL THEN
    RAISE EXCEPTION 'ABORT: expected connected KÖL stay RPC missing';
  END IF;
  IF to_regprocedure(
    'private.client_stay_booking_create_atomic_internal(uuid,date,date,integer,text)'
  ) IS NULL THEN
    RAISE EXCEPTION 'ABORT: expected internal stay function missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
      WHERE p.oid = 'private.client_stay_booking_create_atomic_internal(uuid,date,date,integer,text)'::regprocedure
        AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'ABORT: internal booking function is not SECURITY DEFINER';
  END IF;
END
$guard$;

REVOKE INSERT ON TABLE public.bookings FROM anon, authenticated;
DROP POLICY IF EXISTS "clients create own bookings" ON public.bookings;

DO $verify$
BEGIN
  IF has_table_privilege('anon','public.bookings','INSERT')
     OR has_table_privilege('authenticated','public.bookings','INSERT')
  THEN
    RAISE EXCEPTION 'ABORT: booking direct INSERT grant survives';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bookings'
      AND policyname = 'clients create own bookings'
  ) THEN
    RAISE EXCEPTION 'ABORT: direct INSERT policy survives';
  END IF;
  IF NOT has_function_privilege(
    'authenticated',
    'public.client_stay_booking_create_atomic(uuid,date,date,integer,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'ABORT: authenticated stay RPC EXECUTE missing';
  END IF;
END
$verify$;

COMMIT;

-- This SQL alone DOES NOT prove end-to-end booking success.
-- Verify in an isolated clone with client JWT: direct INSERT rejected;
-- legacy stay RPC creates a booking with server price; replay is stable;
-- competing clients cannot oversell the last room.

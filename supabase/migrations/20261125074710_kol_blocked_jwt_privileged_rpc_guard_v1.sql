-- KÖL P0. Blocking an account must deny privileged public RPC calls even
-- when the caller still holds a cryptographically valid JWT.
-- Preserve every existing function body, ownership, return type and grant.
-- Only prepend the active-profile/role precondition to trusted entry points.
DO $kol_rpc_guard$
DECLARE
  p record;
  original text;
  patched text;
  patched_count integer := 0;
  names text[] := ARRAY[
    'admin_confirm_intake_order_atomic','admin_link_intake_pickup_order_atomic',
    'assign_courier_atomic','claim_anonymous_intake_by_verified_email_atomic',
    'courier_transition_delivery_atomic','create_order_atomic',
    'create_stay_booking_atomic','create_tour_booking_atomic',
    'get_courier_active_deliveries','quote_intake_delivery_fee_atomic'
  ];
BEGIN
  -- An empty local Supabase instance intentionally has no KÖL baseline.
  IF to_regclass('public.orders') IS NULL AND to_regclass('public.user_profiles') IS NULL THEN
    RAISE NOTICE 'KOL_BASELINE_SCHEMA_NOT_INSTALLED__RPC_GUARD_SKIPPED';
    RETURN;
  END IF;
  IF to_regprocedure('public.kol_active_actor_v1()') IS NULL THEN
    RAISE EXCEPTION 'KOL_ACTIVE_ACTOR_RLS_GUARD_REQUIRED_FIRST';
  END IF;
  IF (SELECT count(*) FROM pg_proc f JOIN pg_namespace n ON n.oid=f.pronamespace
      WHERE n.nspname='public' AND f.proname=ANY(names)
        AND f.prosecdef AND has_function_privilege('authenticated',f.oid,'EXECUTE')
        AND NOT has_function_privilege('anon',f.oid,'EXECUTE'))<>10 THEN
    RAISE EXCEPTION 'KOL_BLOCKED_JWT_RPC_FUNCTION_SET_CHANGED';
  END IF;
  FOR p IN SELECT f.oid,f.proname FROM pg_proc f
    JOIN pg_namespace n ON n.oid=f.pronamespace
    WHERE n.nspname='public' AND f.proname=ANY(names)
    ORDER BY f.proname
  LOOP
    original:=pg_get_functiondef(p.oid);
    IF position('kol_active_actor_v1()' in original)>0 THEN CONTINUE; END IF;
    patched:=regexp_replace(original,'^[ \t]*begin[ \t]*$',
      'begin'||E'\n'||'  IF NOT public.kol_active_actor_v1() THEN'
      ||E'\n'||'    RAISE EXCEPTION ''active_account_required'' USING ERRCODE=''42501'';'
      ||E'\n'||'  END IF;', 'im');
    IF patched=original THEN
      RAISE EXCEPTION 'KOL_RPC_START_ANCHOR_MISSING: %',p.proname;
    END IF;
    EXECUTE patched;
    patched_count:=patched_count+1;
  END LOOP;
  IF (SELECT count(*) FROM pg_proc f JOIN pg_namespace n ON n.oid=f.pronamespace
      WHERE n.nspname='public' AND f.proname=ANY(names)
        AND position('kol_active_actor_v1()' in pg_get_functiondef(f.oid))>0)<>10 THEN
    RAISE EXCEPTION 'KOL_RPC_GUARD_INCOMPLETE';
  END IF;
  RAISE NOTICE 'KOL_BLOCKED_JWT_RPC_GUARD_PASS: % functions modified',patched_count;
END $kol_rpc_guard$;

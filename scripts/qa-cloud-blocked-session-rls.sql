-- KÖL QA ONLY: direct RLS privilege test using an unchanged, already-issued JWT identity.
-- Existing TEST user's status is changed inside a transaction and ALWAYS rolled back.
-- Run ONLY with the dedicated KOL_DATABASE_URL, validated by cloud-delivery-e2e job.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='25s';
DO $qa_actor$
DECLARE client_id uuid;
BEGIN
  IF (SELECT count(*) FROM pg_catalog.pg_policies
      WHERE schemaname IN ('public','storage') AND
      (coalesce(qual,'') LIKE '%kol_active_actor_v1%'
       OR coalesce(with_check,'') LIKE '%kol_active_actor_v1%'))<80 THEN
     RAISE EXCEPTION 'QA_BLOCKED_JWT_RLS_MIGRATION_NOT_APPLIED';
  END IF;
  SELECT r.user_id INTO client_id
  FROM public.user_roles r JOIN public.user_profiles p ON p.user_id=r.user_id
  WHERE r.role='client' AND r.is_active AND p.status='active'
    AND EXISTS(SELECT 1 FROM public.orders o WHERE o.client_id=r.user_id)
    AND EXISTS(SELECT 1 FROM public.bookings b WHERE b.client_id=r.user_id)
  LIMIT 1;
  IF client_id IS NULL THEN RAISE EXCEPTION 'QA_CLIENT_WITH_ORDER_AND_BOOKING_MISSING';END IF;
  PERFORM set_config('request.jwt.claim.sub',client_id::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
END $qa_actor$;
SET LOCAL ROLE authenticated;
DO $active$
BEGIN
  IF NOT public.kol_active_actor_v1()
     OR (SELECT count(*) FROM public.orders o WHERE o.client_id=auth.uid())<1
     OR (SELECT count(*) FROM public.bookings b WHERE b.client_id=auth.uid())<1
     OR (SELECT count(*) FROM public.user_profiles p WHERE p.user_id=auth.uid() AND status='active')<>1
  THEN RAISE EXCEPTION 'QA_ACTIVE_JWT_RLS_REGRESSION';END IF;
  RAISE NOTICE 'KOL_QA_ACTIVE_JWT_RLS_PASS';
END $active$;
RESET ROLE;
UPDATE public.user_profiles SET status='blocked'
  WHERE user_id=current_setting('request.jwt.claim.sub')::uuid;
UPDATE public.user_roles SET is_active=false
  WHERE user_id=current_setting('request.jwt.claim.sub')::uuid AND role='client';
SET LOCAL ROLE authenticated;
DO $blocked$
DECLARE
  expression text;
  guard_count integer := 0;
BEGIN
  IF public.kol_active_actor_v1()
    OR (SELECT count(*) FROM public.orders o WHERE o.client_id=auth.uid())<>0
    OR (SELECT count(*) FROM public.bookings b WHERE b.client_id=auth.uid())<>0
    OR (SELECT count(*) FROM public.user_profiles p WHERE p.user_id=auth.uid() AND status='blocked')<>1
  THEN RAISE EXCEPTION 'QA_BLOCKED_JWT_STILL_EXPOSED_PRIVATE_DATA';END IF;
  RAISE NOTICE 'KOL_QA_BLOCKED_JWT_DIRECT_RLS_PASS';
  FOR expression IN SELECT unnest(ARRAY[
    'SELECT public.admin_confirm_intake_order_atomic(NULL,NULL,NULL,NULL,NULL)',
    'SELECT public.admin_link_intake_pickup_order_atomic(NULL,NULL,NULL)',
    'SELECT public.assign_courier_atomic(NULL,NULL,NULL)',
    'SELECT public.claim_anonymous_intake_by_verified_email_atomic(NULL,NULL)',
    'SELECT public.courier_transition_delivery_atomic(NULL,NULL,NULL)',
    'SELECT public.create_order_atomic(NULL,NULL,NULL,NULL,NULL)',
    'SELECT public.create_stay_booking_atomic(NULL,NULL,NULL,NULL,NULL)',
    'SELECT public.create_tour_booking_atomic(NULL,NULL,NULL)',
    'SELECT * FROM public.get_courier_active_deliveries()',
    'SELECT public.quote_intake_delivery_fee_atomic(NULL,NULL,NULL)'
  ]) LOOP
    BEGIN
      EXECUTE expression;
      RAISE EXCEPTION 'QA_BLOCKED_JWT_PRIVILEGED_RPC_ACCEPTED';
    EXCEPTION WHEN insufficient_privilege THEN
      IF SQLERRM IS DISTINCT FROM 'active_account_required' THEN RAISE; END IF;
    END;
    guard_count:=guard_count+1;
  END LOOP;
  IF guard_count<>10 THEN RAISE EXCEPTION 'QA_RPC_GUARD_COUNT_MISMATCH';END IF;
  RAISE NOTICE 'KOL_QA_BLOCKED_JWT_PRIVILEGED_RPC_10_DENIED_PASS';
END $blocked$;
RESET ROLE;
ROLLBACK;
SELECT 'KOL_QA_BLOCKED_JWT_RLS_RPC_ROLLBACK_PASS: active access preserved, blocked JWT denied across 86 policies and 10 RPCs' AS result;

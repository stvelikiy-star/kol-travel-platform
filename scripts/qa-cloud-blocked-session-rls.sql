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
BEGIN
  IF public.kol_active_actor_v1()
    OR (SELECT count(*) FROM public.orders o WHERE o.client_id=auth.uid())<>0
    OR (SELECT count(*) FROM public.bookings b WHERE b.client_id=auth.uid())<>0
    OR (SELECT count(*) FROM public.user_profiles p WHERE p.user_id=auth.uid() AND status='blocked')<>1
  THEN RAISE EXCEPTION 'QA_BLOCKED_JWT_STILL_EXPOSED_PRIVATE_DATA';END IF;
  RAISE NOTICE 'KOL_QA_BLOCKED_JWT_DIRECT_RLS_PASS';
END $blocked$;
RESET ROLE;
ROLLBACK;
SELECT 'KOL_QA_BLOCKED_JWT_RLS_ROLLBACK_PASS: active access preserved, blocked old JWT denied' AS result;

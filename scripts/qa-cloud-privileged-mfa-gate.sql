-- QA ONLY: real privileged SQL/JWT/RPC gate regression, all mutations rolled back.
-- Must run with the protected KOL_DATABASE_URL; never Production.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='4s';
SET LOCAL statement_timeout='35s';
DO $qa_preflight$
DECLARE admin_user uuid; client_user uuid;
BEGIN
  IF to_regclass('private.kol_privileged_mfa_controls_v1') IS NULL OR
    to_regprocedure('private.kol_privileged_mfa_ok_v1()') IS NULL
  THEN RAISE EXCEPTION 'KOL_QA_MFA_MIGRATION_NOT_APPLIED'; END IF;
  IF (SELECT enabled FROM private.kol_privileged_mfa_controls_v1 WHERE singleton) IS DISTINCT FROM FALSE
  THEN RAISE EXCEPTION 'KOL_QA_MFA_MUST_BE_STAGED_OFF'; END IF;
  IF has_table_privilege('authenticated','private.kol_privileged_mfa_controls_v1','UPDATE') OR
     has_table_privilege('anon','private.kol_privileged_mfa_controls_v1','SELECT')
  THEN RAISE EXCEPTION 'KOL_QA_MFA_CONTROL_PRIVILEGE_LEAK'; END IF;
  IF position('finance_admin' in pg_get_functiondef('private.kol_privileged_mfa_ok_v1()'::regprocedure))=0
  THEN RAISE EXCEPTION 'KOL_QA_FINANCE_ADMIN_MFA_POLICY_MISSING'; END IF;
  SELECT r.user_id INTO admin_user FROM public.user_roles r
    JOIN public.user_profiles p ON p.user_id=r.user_id
    WHERE r.role='super_admin' AND r.is_active AND p.status='active'
    ORDER BY r.user_id LIMIT 1;
  SELECT r.user_id INTO client_user FROM public.user_roles r
    JOIN public.user_profiles p ON p.user_id=r.user_id
    WHERE r.role='client' AND r.is_active AND p.status='active'
    ORDER BY r.user_id LIMIT 1;
  IF admin_user IS NULL OR client_user IS NULL
  THEN RAISE EXCEPTION 'KOL_QA_MFA_REQUIRED_FIXTURES_MISSING'; END IF;
  PERFORM set_config('kol.qa.mfa.admin',admin_user::text,true);
  PERFORM set_config('kol.qa.mfa.client',client_user::text,true);
END $qa_preflight$;
SELECT set_config('request.jwt.claims',jsonb_build_object(
  'sub',current_setting('kol.qa.mfa.admin'),'role','authenticated','aal','aal1')::text,true);
SET LOCAL ROLE authenticated;
DO $mfa_staged$
BEGIN
 IF NOT public.kol_active_actor_v1()
 THEN RAISE EXCEPTION 'KOL_QA_MFA_STAGED_OLD_ADMIN_DENIED'; END IF;
 RAISE NOTICE 'KOL_QA_MFA_STAGED_OFF_PASS';
END $mfa_staged$;
RESET ROLE;
-- Activation and all tests are inside the same rollback-only transaction.
UPDATE private.kol_privileged_mfa_controls_v1 SET enabled=TRUE WHERE singleton;
SET LOCAL ROLE authenticated;
DO $mfa_denial$
DECLARE expression text; count_rpc int:=0;
BEGIN
 IF public.kol_active_actor_v1()
 THEN RAISE EXCEPTION 'KOL_QA_MFA_AAL1_ADMIN_ALLOWED'; END IF;
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
   RAISE EXCEPTION 'KOL_QA_MFA_AAL1_RPC_EXECUTED';
  EXCEPTION WHEN insufficient_privilege THEN
   IF SQLERRM IS DISTINCT FROM 'active_account_required' THEN RAISE; END IF;
  END;
  count_rpc:=count_rpc+1;
 END LOOP;
 IF count_rpc<>10 THEN RAISE EXCEPTION 'KOL_QA_MFA_RPC_SET_CHANGED'; END IF;
 RAISE NOTICE 'KOL_QA_MFA_AAL1_RPC_10_DENIED_PASS';
END $mfa_denial$;
RESET ROLE;
SELECT set_config('request.jwt.claims',jsonb_build_object(
  'sub',current_setting('kol.qa.mfa.admin'),'role','authenticated','aal','aal2')::text,true);
SET LOCAL ROLE authenticated;
DO $mfa_aal2$
BEGIN
 IF NOT public.kol_active_actor_v1() THEN RAISE EXCEPTION 'KOL_QA_MFA_AAL2_ADMIN_DENIED'; END IF;
 RAISE NOTICE 'KOL_QA_MFA_AAL2_ADMIN_PASS';
END $mfa_aal2$;
RESET ROLE;
SELECT set_config('request.jwt.claims',jsonb_build_object(
  'sub',current_setting('kol.qa.mfa.client'),'role','authenticated','aal','aal1')::text,true);
SET LOCAL ROLE authenticated;
DO $mfa_client$
BEGIN
 IF NOT public.kol_active_actor_v1() THEN RAISE EXCEPTION 'KOL_QA_MFA_CLIENT_DENIED'; END IF;
 RAISE NOTICE 'KOL_QA_MFA_CLIENT_UNAFFECTED_PASS';
END $mfa_client$;
RESET ROLE;
ROLLBACK;
SELECT 'KOL_QA_PRIVILEGED_MFA_ROLLBACK_PASS' AS result;

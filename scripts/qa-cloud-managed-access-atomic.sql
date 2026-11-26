-- QA only; all role and audit mutations roll back.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='4s';
SET LOCAL statement_timeout='35s';
SELECT set_config('kol.qa.access.actor',(select user_id::text from public.user_roles where role='super_admin' and is_active order by user_id limit 1),true);
SELECT set_config('kol.qa.access.target',(select user_id::text from public.user_roles where role='content_manager' and is_active order by user_id limit 1),true);
SELECT set_config('kol.qa.access.otheradmin',(select user_id::text from public.user_roles where role='super_admin' and is_active and user_id<>current_setting('kol.qa.access.actor')::uuid limit 1),true);
ALTER TABLE public.audit_logs ADD CONSTRAINT kol_qa_atomic_forced_audit_failure CHECK (request_id IS DISTINCT FROM '00000000-0000-4000-8000-000000000001') NOT VALID;
SET LOCAL ROLE service_role;
DO $test$
DECLARE a uuid:=current_setting('kol.qa.access.actor')::uuid; t uuid:=current_setting('kol.qa.access.target')::uuid; b uuid:=current_setting('kol.qa.access.otheradmin')::uuid; r text;
BEGIN
 IF a IS NULL OR t IS NULL OR b IS NULL THEN RAISE EXCEPTION 'QA access fixtures missing'; END IF;
 IF has_function_privilege('anon','public.kol_update_managed_access_v1(uuid,uuid,text,text,text,text,text,uuid)','EXECUTE') OR has_function_privilege('authenticated','public.kol_update_managed_access_v1(uuid,uuid,text,text,text,text,text,uuid)','EXECUTE') THEN RAISE EXCEPTION 'RPC public grant'; END IF;
 BEGIN
   PERFORM public.kol_update_managed_access_v1(a,t,'change_role','finance_admin','QA audit failure','content_manager','active','00000000-0000-4000-8000-000000000001');
   RAISE EXCEPTION 'audit failure not enforced';
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=t AND role='content_manager' AND is_active) OR NOT EXISTS(SELECT 1 FROM public.admin_profiles WHERE user_id=t AND admin_level='content_manager') OR EXISTS(SELECT 1 FROM public.audit_logs WHERE request_id='00000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'audit failure leaked changes'; END IF;
 r:=public.kol_update_managed_access_v1(a,t,'change_role','finance_admin','QA role transition','content_manager','active','00000000-0000-4000-8000-000000000002');
 IF r<>'updated' OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=t AND role='finance_admin') OR NOT EXISTS(SELECT 1 FROM public.admin_profiles WHERE user_id=t AND admin_level='finance_admin') OR NOT EXISTS(SELECT 1 FROM public.audit_logs WHERE request_id='00000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'transition inconsistent'; END IF;
 BEGIN
   PERFORM public.kol_update_managed_access_v1(a,t,'change_role','support_admin','QA stale request','content_manager','active',gen_random_uuid());
   RAISE EXCEPTION 'stale accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'protected' THEN RAISE; END IF; END;
 BEGIN
   PERFORM public.kol_update_managed_access_v1(t,a,'block',NULL,'QA finance denied','super_admin','active',gen_random_uuid());
   RAISE EXCEPTION 'finance admin can manage users';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   PERFORM public.kol_update_managed_access_v1(a,b,'block',NULL,'QA admin protection','super_admin','active',gen_random_uuid());
   RAISE EXCEPTION 'super admin blocked';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'protected' THEN RAISE; END IF; END;
 r:=public.kol_update_managed_access_v1(a,t,'block',NULL,'QA block','finance_admin','active',gen_random_uuid());
 IF r<>'updated' OR NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE user_id=t AND status='blocked') OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=t AND is_active) THEN RAISE EXCEPTION 'block inconsistent'; END IF;
 r:=public.kol_update_managed_access_v1(a,t,'unblock',NULL,'QA unblock','finance_admin','blocked',gen_random_uuid());
 IF r<>'updated' OR NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE user_id=t AND status='active') OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=t AND is_active) THEN RAISE EXCEPTION 'unblock inconsistent'; END IF;
END $test$;
RESET ROLE;
SELECT set_config('request.jwt.claims',json_build_object('sub',current_setting('kol.qa.access.target'),'role','authenticated','aal','aal1')::text,true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN IF NOT public.is_finance_admin() OR NOT public.kol_active_actor_v1() THEN RAISE EXCEPTION 'finance admin permission missing'; END IF; END $$;
RESET ROLE;
UPDATE private.kol_privileged_mfa_controls_v1 SET enabled=true WHERE singleton;
SET LOCAL ROLE authenticated;
DO $$ BEGIN IF public.kol_active_actor_v1() THEN RAISE EXCEPTION 'finance admin AAL1 allowed'; END IF; END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims',json_build_object('sub',current_setting('kol.qa.access.target'),'role','authenticated','aal','aal2')::text,true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN IF NOT public.kol_active_actor_v1() THEN RAISE EXCEPTION 'finance admin AAL2 denied'; END IF; END $$;
RESET ROLE;
ROLLBACK;
SELECT 'KOL_MANAGED_ACCESS_ATOMIC_ROLLBACK_AND_FINANCE_MFA_PASS' AS result;


BEGIN;
SET LOCAL lock_timeout='4s';
SET LOCAL statement_timeout='35s';
SELECT set_config('kol.qa.actor',(select user_id::text from public.user_roles where role='super_admin' and is_active order by user_id limit 1),true);
SELECT set_config('kol.qa.target',(select user_id::text from public.user_roles where role='content_manager' and is_active limit 1),true);
ALTER TABLE public.user_profiles ADD CONSTRAINT kol_qa_forced_profile_failure CHECK (status <> 'blocked') NOT VALID;
SET LOCAL ROLE service_role;
DO $$ DECLARE a uuid:=current_setting('kol.qa.actor')::uuid; t uuid:=current_setting('kol.qa.target')::uuid; n uuid:=gen_random_uuid(); BEGIN
IF a IS NULL OR t IS NULL THEN RAISE EXCEPTION 'QA fixtures missing'; END IF;
BEGIN
PERFORM public.kol_update_managed_access_v1(a,t,'block',NULL,'QA profile forced failure','content_manager','active',n);
RAISE EXCEPTION 'profile failure not enforced';
EXCEPTION WHEN check_violation THEN NULL; END;
IF NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE user_id=t AND status='active') OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=t AND role='content_manager' AND is_active) OR EXISTS(SELECT 1 FROM public.audit_logs WHERE request_id=n::text) THEN RAISE EXCEPTION 'profile rollback failed'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'KOL_PROFILE_FAILURE_ROLLBACK_PASS' AS result;

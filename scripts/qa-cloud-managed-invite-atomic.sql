-- QA only, no real SMTP and no committed identities.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='4s';
SET LOCAL statement_timeout='35s';
SELECT set_config('kol.qa.actor',(SELECT user_id::text FROM public.user_roles WHERE role='super_admin' AND is_active ORDER BY user_id LIMIT 1),true);
SELECT set_config('kol.qa.client',(SELECT user_id::text FROM public.user_roles WHERE role='client' AND is_active LIMIT 1),true);
SELECT set_config('kol.qa.partner',(SELECT id::text FROM public.partners ORDER BY id LIMIT 1),true);
INSERT INTO auth.users(id,email,created_at,updated_at,invited_at,role,aud) VALUES
('00000000-0000-4000-8000-000000000011','kol-atomic-invite-finance@example.invalid',now(),now(),now(),'authenticated','authenticated'),
('00000000-0000-4000-8000-000000000012','kol-atomic-invite-courier@example.invalid',now(),now(),now(),'authenticated','authenticated'),
('00000000-0000-4000-8000-000000000013','kol-atomic-invite-partner@example.invalid',now(),now(),now(),'authenticated','authenticated');
ALTER TABLE public.audit_logs ADD CONSTRAINT kol_qa_invite_forced_audit_failure CHECK (request_id IS DISTINCT FROM '00000000-0000-4000-8000-000000000014') NOT VALID;
SET LOCAL ROLE service_role;
DO $test$
DECLARE a uuid:=current_setting('kol.qa.actor')::uuid; c uuid:=current_setting('kol.qa.client')::uuid; p uuid:=current_setting('kol.qa.partner')::uuid; f uuid:='00000000-0000-4000-8000-000000000011'; d uuid:='00000000-0000-4000-8000-000000000012'; m uuid:='00000000-0000-4000-8000-000000000013';
BEGIN
 IF a IS NULL OR c IS NULL OR p IS NULL THEN RAISE EXCEPTION 'QA fixtures missing'; END IF;
 IF has_function_privilege('anon','public.kol_provision_managed_invite_v1(uuid,uuid,text,text,text,uuid,text,uuid)','EXECUTE') OR has_function_privilege('authenticated','public.kol_provision_managed_invite_v1(uuid,uuid,text,text,text,uuid,text,uuid)','EXECUTE') THEN RAISE EXCEPTION 'public invite RPC grant'; END IF;
 BEGIN
 PERFORM public.kol_provision_managed_invite_v1(a,f,'kol-atomic-invite-finance@example.invalid','QA Finance','finance_admin',NULL,'QA forced invite audit failure','00000000-0000-4000-8000-000000000014');
 RAISE EXCEPTION 'audit failure not enforced';
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF EXISTS(SELECT 1 FROM public.user_profiles WHERE user_id=f) OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=f) OR EXISTS(SELECT 1 FROM public.admin_profiles WHERE user_id=f) THEN RAISE EXCEPTION 'partial invite leaked'; END IF;
 BEGIN
 PERFORM public.kol_provision_managed_invite_v1(c,f,'kol-atomic-invite-finance@example.invalid','QA Finance','finance_admin',NULL,'QA unauthorized invite',gen_random_uuid());
 RAISE EXCEPTION 'client provision allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
 PERFORM public.kol_provision_managed_invite_v1(a,f,'kol-atomic-invite-finance@example.invalid','QA Finance','super_admin',NULL,'QA protected role',gen_random_uuid());
 RAISE EXCEPTION 'super admin invitation allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'invalid' THEN RAISE; END IF; END;
 IF public.kol_provision_managed_invite_v1(a,f,'kol-atomic-invite-finance@example.invalid','QA Finance','finance_admin',NULL,'QA finance invite',gen_random_uuid())<>'invited' THEN RAISE EXCEPTION 'finance invite failed'; END IF;
 IF public.kol_provision_managed_invite_v1(a,d,'kol-atomic-invite-courier@example.invalid','QA Courier','courier',NULL,'QA courier invite',gen_random_uuid())<>'invited' THEN RAISE EXCEPTION 'courier invite failed'; END IF;
 IF public.kol_provision_managed_invite_v1(a,m,'kol-atomic-invite-partner@example.invalid','QA Partner','partner_staff',p,'QA partner invite',gen_random_uuid())<>'invited' THEN RAISE EXCEPTION 'partner invite failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.admin_profiles WHERE user_id=f AND admin_level='finance_admin') OR NOT EXISTS(SELECT 1 FROM public.courier_profiles WHERE user_id=d) OR NOT EXISTS(SELECT 1 FROM public.partner_staff WHERE user_id=m AND business_id=p AND role='partner_staff' AND is_active) OR NOT EXISTS(SELECT 1 FROM public.partner_profiles WHERE user_id=m AND business_id=p) OR (SELECT count(*) FROM public.audit_logs WHERE entity_id IN(f,d,m) AND action='user.invite')<>3 THEN RAISE EXCEPTION 'provision consistency failure'; END IF;
 BEGIN
 PERFORM public.kol_provision_managed_invite_v1(a,f,'kol-atomic-invite-finance@example.invalid','QA Finance','support_admin',NULL,'QA duplicate invite',gen_random_uuid());
 RAISE EXCEPTION 'existing profile overwritten';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'protected' THEN RAISE; END IF; END;
END $test$;
RESET ROLE;
ROLLBACK;
SELECT 'KOL_ATOMIC_INVITE_PROVISION_ROLLBACK_PASS' AS result;

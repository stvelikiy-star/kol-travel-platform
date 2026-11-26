-- Staff invitation application provisioning is atomic. Auth SMTP remains external.
DO $migration$
BEGIN
IF to_regclass('public.orders') IS NULL AND to_regclass('public.user_profiles') IS NULL THEN
 RAISE NOTICE 'KOL_BASELINE_SCHEMA_NOT_INSTALLED__INVITE_PROVISION_SKIPPED'; RETURN;
END IF;
IF to_regclass('public.user_roles') IS NULL OR to_regclass('public.admin_profiles') IS NULL OR
 to_regclass('public.partner_profiles') IS NULL OR to_regclass('public.partner_staff') IS NULL OR
 to_regclass('public.courier_profiles') IS NULL OR to_regclass('public.audit_logs') IS NULL THEN
 RAISE EXCEPTION 'invite_provision_baseline_missing';
END IF;
EXECUTE $ddl$
CREATE OR REPLACE FUNCTION public.kol_provision_managed_invite_v1(
 p_actor uuid,p_target uuid,p_email text,p_full_name text,p_role text,p_partner_id uuid,p_reason text,p_request_id uuid
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $fn$
DECLARE
 v_admin_roles constant text[] := ARRAY['dispatcher','support_admin','finance_admin','content_manager'];
 v_partner_roles constant text[] := ARRAY['partner_owner','partner_manager','partner_staff'];
BEGIN
 IF current_user<>'service_role' THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501'; END IF;
 IF p_actor IS NULL OR p_target IS NULL OR p_actor=p_target OR p_request_id IS NULL OR
 p_role IS NULL OR NOT(p_role=ANY(v_admin_roles) OR p_role=ANY(v_partner_roles) OR p_role='courier') OR
 length(btrim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 500 OR
 length(btrim(coalesce(p_full_name,''))) NOT BETWEEN 2 AND 120 OR
 length(coalesce(p_email,'')) NOT BETWEEN 3 AND 254 OR p_email<>lower(btrim(p_email)) OR position('@' IN p_email)<2
 THEN RAISE EXCEPTION 'invalid'; END IF;
 IF (p_role=ANY(v_partner_roles)) IS DISTINCT FROM (p_partner_id IS NOT NULL) THEN RAISE EXCEPTION 'invalid_scope'; END IF;
 PERFORM 1 FROM public.user_profiles WHERE user_id=p_actor AND status='active' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.user_roles WHERE user_id=p_actor FOR UPDATE;
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=p_actor AND is_active)<>1 OR
 NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_actor AND is_active AND role='super_admin') OR
 NOT EXISTS(SELECT 1 FROM public.admin_profiles WHERE user_id=p_actor) THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501'; END IF;
 -- Serialize even before a target profile exists.
 PERFORM pg_advisory_xact_lock(hashtextextended('kol:managed-invite:'||p_target::text,0));
 IF EXISTS(SELECT 1 FROM public.user_profiles WHERE user_id=p_target OR lower(email)=p_email) OR
 EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_target) OR
 EXISTS(SELECT 1 FROM public.admin_profiles WHERE user_id=p_target) OR
 EXISTS(SELECT 1 FROM public.partner_profiles WHERE user_id=p_target) OR
 EXISTS(SELECT 1 FROM public.partner_staff WHERE user_id=p_target) OR
 EXISTS(SELECT 1 FROM public.courier_profiles WHERE user_id=p_target) OR
 EXISTS(SELECT 1 FROM public.audit_logs WHERE request_id=p_request_id::text)
 THEN RAISE EXCEPTION 'protected'; END IF;
 IF p_partner_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.partners WHERE id=p_partner_id) THEN RAISE EXCEPTION 'invalid_scope'; END IF;
 INSERT INTO public.user_profiles(user_id,email,full_name,status) VALUES(p_target,p_email,btrim(p_full_name),'active');
 INSERT INTO public.user_roles(user_id,role,scope_id,is_active) VALUES(p_target,p_role,p_partner_id,true);
 IF p_role=ANY(v_partner_roles) THEN
 INSERT INTO public.partner_profiles(user_id,business_id) VALUES(p_target,p_partner_id);
 INSERT INTO public.partner_staff(user_id,business_id,role,is_active) VALUES(p_target,p_partner_id,p_role,true);
 ELSIF p_role='courier' THEN
 INSERT INTO public.courier_profiles(user_id) VALUES(p_target);
 ELSE
 INSERT INTO public.admin_profiles(user_id,admin_level) VALUES(p_target,p_role);
 END IF;
 INSERT INTO public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,before,after,reason,request_id)
 VALUES(p_actor,'super_admin','user.invite','user_access',p_target,NULL,jsonb_build_object('email',p_email,'role',p_role,'partner_id',p_partner_id),btrim(p_reason),p_request_id::text);
 RETURN 'invited';
END $fn$;
$ddl$;
REVOKE ALL ON FUNCTION public.kol_provision_managed_invite_v1(uuid,uuid,text,text,text,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kol_provision_managed_invite_v1(uuid,uuid,text,text,text,uuid,text,uuid) TO service_role;
END $migration$;

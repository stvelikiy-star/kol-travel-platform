-- Atomic managed access updates; invitations are a separate Auth lifecycle.
DO $migration$
BEGIN
IF to_regclass('public.orders') IS NULL AND to_regclass('public.user_profiles') IS NULL THEN
  RAISE NOTICE 'KOL_BASELINE_SCHEMA_NOT_INSTALLED__MANAGED_ACCESS_SKIPPED'; RETURN;
END IF;
IF to_regclass('public.user_profiles') IS NULL OR to_regclass('public.user_roles') IS NULL OR
   to_regclass('public.admin_profiles') IS NULL OR to_regclass('public.partner_staff') IS NULL OR
   to_regclass('public.audit_logs') IS NULL THEN RAISE EXCEPTION 'managed_access_baseline_missing'; END IF;
EXECUTE $ddl$
CREATE OR REPLACE FUNCTION public.kol_update_managed_access_v1(
 p_actor uuid,p_target uuid,p_command text,p_next_role text,p_reason text,
 p_expected_role text,p_expected_status text,p_request_id uuid
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $fn$
DECLARE
 v_profile public.user_profiles%ROWTYPE;
 v_role public.user_roles%ROWTYPE;
 v_admin_roles constant text[] := ARRAY['dispatcher','support_admin','finance_admin','content_manager'];
 v_partner_roles constant text[] := ARRAY['partner_owner','partner_manager','partner_staff'];
 v_n integer;
 v_next_status text;
 v_next_active boolean;
 v_new_role text;
BEGIN
 IF current_user <> 'service_role' THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501'; END IF;
 IF p_actor IS NULL OR p_target IS NULL OR p_actor=p_target OR p_request_id IS NULL OR
    p_command IS NULL OR p_command NOT IN ('block','unblock','change_role') OR
    length(btrim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 500 THEN
   RAISE EXCEPTION 'invalid';
 END IF;
 -- Lock the actor first; privileged identities are not manageable targets.
 PERFORM 1 FROM public.user_profiles WHERE user_id=p_actor AND status='active' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.user_roles WHERE user_id=p_actor FOR UPDATE;
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=p_actor AND is_active)<>1 OR
    NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_actor AND is_active AND role='super_admin') OR
    NOT EXISTS(SELECT 1 FROM public.admin_profiles WHERE user_id=p_actor) THEN
   RAISE EXCEPTION 'denied' USING ERRCODE='42501';
 END IF;
 -- Serialize target mutations, including competing requests by different admins.
 SELECT * INTO v_profile FROM public.user_profiles WHERE user_id=p_target FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'protected'; END IF;
 PERFORM 1 FROM public.user_roles WHERE user_id=p_target FOR UPDATE;
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=p_target)<>1 THEN RAISE EXCEPTION 'protected'; END IF;
 SELECT * INTO v_role FROM public.user_roles WHERE user_id=p_target;
 IF NOT (v_role.role=ANY(v_admin_roles) OR v_role.role=ANY(v_partner_roles) OR v_role.role='courier') THEN
   RAISE EXCEPTION 'protected';
 END IF;
 IF v_role.role IS DISTINCT FROM p_expected_role OR v_profile.status IS DISTINCT FROM p_expected_status THEN
   RAISE EXCEPTION 'protected';
 END IF;
 IF EXISTS(SELECT 1 FROM public.audit_logs WHERE request_id=p_request_id::text) THEN RAISE EXCEPTION 'protected'; END IF;
 v_new_role:=v_role.role; v_next_status:=v_profile.status; v_next_active:=v_role.is_active;
 IF p_command='change_role' THEN
   IF v_profile.status<>'active' OR NOT v_role.is_active THEN RAISE EXCEPTION 'protected'; END IF;
   IF p_next_role IS NULL OR p_next_role=v_role.role OR NOT (p_next_role=ANY(v_admin_roles) OR p_next_role=ANY(v_partner_roles) OR p_next_role='courier') THEN RAISE EXCEPTION 'invalid'; END IF;
   IF NOT ((v_role.role=ANY(v_admin_roles) AND p_next_role=ANY(v_admin_roles)) OR
      (v_role.role=ANY(v_partner_roles) AND p_next_role=ANY(v_partner_roles))) THEN RAISE EXCEPTION 'role_family'; END IF;
   v_new_role:=p_next_role;
   IF v_role.role=ANY(v_admin_roles) THEN
     UPDATE public.admin_profiles SET admin_level=v_new_role WHERE user_id=p_target AND admin_level=v_role.role;
   ELSE
     UPDATE public.partner_staff SET role=v_new_role WHERE user_id=p_target AND business_id=v_role.scope_id AND role=v_role.role AND is_active;
   END IF;
   GET DIAGNOSTICS v_n=ROW_COUNT;
   IF v_n<>1 THEN RAISE EXCEPTION 'update_failed'; END IF;
 ELSE
   IF (p_command='block' AND (v_profile.status<>'active' OR NOT v_role.is_active)) OR
      (p_command='unblock' AND (v_profile.status<>'blocked' OR v_role.is_active)) THEN RAISE EXCEPTION 'protected'; END IF;
   v_next_active:=p_command='unblock';
   v_next_status:=CASE WHEN v_next_active THEN 'active' ELSE 'blocked' END;
   IF v_role.role=ANY(v_partner_roles) THEN
     UPDATE public.partner_staff SET is_active=v_next_active WHERE user_id=p_target AND business_id=v_role.scope_id AND role=v_role.role AND is_active=v_role.is_active;
     GET DIAGNOSTICS v_n=ROW_COUNT;
     IF v_n<>1 THEN RAISE EXCEPTION 'update_failed'; END IF;
   END IF;
   UPDATE public.user_profiles SET status=v_next_status WHERE user_id=p_target;
   GET DIAGNOSTICS v_n=ROW_COUNT;
   IF v_n<>1 THEN RAISE EXCEPTION 'update_failed'; END IF;
 END IF;
 UPDATE public.user_roles SET role=v_new_role,is_active=v_next_active WHERE id=v_role.id;
 GET DIAGNOSTICS v_n=ROW_COUNT;
 IF v_n<>1 THEN RAISE EXCEPTION 'update_failed'; END IF;
 INSERT INTO public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,before,after,reason,request_id)
 VALUES(p_actor,'super_admin',CASE WHEN p_command='change_role' THEN 'user.role_changed' ELSE 'user.'||p_command END,
 'user_access',p_target,
 jsonb_build_object('role',v_role.role,'status',v_profile.status,'role_active',v_role.is_active),
 jsonb_build_object('role',v_new_role,'status',v_next_status,'role_active',v_next_active),
 btrim(p_reason),p_request_id::text);
 RETURN 'updated';
END $fn$;
$ddl$;
REVOKE ALL ON FUNCTION public.kol_update_managed_access_v1(uuid,uuid,text,text,text,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kol_update_managed_access_v1(uuid,uuid,text,text,text,text,text,uuid) TO service_role;
END $migration$;

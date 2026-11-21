-- KÖL 046C: transaction-safe content draft/publish/restore. Authenticated CMS roles only.
-- Invoker security keeps RLS. Existing content history and audit triggers remain authoritative.
CREATE OR REPLACE FUNCTION public.kol_site_content_write_v1(
 p_operation text,p_key text,p_locale text,p_value text DEFAULT NULL,p_version integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $body$
DECLARE v public.site_content%ROWTYPE; v_history public.site_content_history%ROWTYPE;
BEGIN
 IF NOT private.can_manage_content() THEN
   RAISE EXCEPTION 'content_role_required' USING ERRCODE='42501';
 END IF;
 IF p_operation NOT IN ('draft','publish','restore')
    OR p_key IS NULL OR p_key !~ '^[a-z0-9_.-]{3,80}$'
    OR p_locale NOT IN ('ru','ky','en') THEN
   RAISE EXCEPTION 'invalid_content_input' USING ERRCODE='22023';
 END IF;
 IF p_operation='draft' THEN
   IF p_value IS NULL OR length(p_value)>2000 THEN
     RAISE EXCEPTION 'invalid_content_value' USING ERRCODE='22023';END IF;
   INSERT INTO public.site_content(content_key,locale,status,value,is_machine_suggestion,updated_by)
   VALUES(p_key,p_locale,'draft',p_value,false,auth.uid())
   ON CONFLICT(content_key,locale,status)
    DO UPDATE SET value=EXCLUDED.value,is_machine_suggestion=false,updated_by=EXCLUDED.updated_by
   RETURNING * INTO v;
 ELSIF p_operation='publish' THEN
   IF p_version IS NULL OR p_version<1 THEN
     RAISE EXCEPTION 'draft_version_required' USING ERRCODE='22023';END IF;
   SELECT * INTO v FROM public.site_content
    WHERE content_key=p_key AND locale=p_locale AND status='draft' FOR UPDATE;
   IF NOT FOUND OR v.version<>p_version THEN
     RAISE EXCEPTION 'stale_or_missing_draft' USING ERRCODE='40001';END IF;
   IF v.is_machine_suggestion THEN
     RAISE EXCEPTION 'translation_not_accepted' USING ERRCODE='42501';END IF;
   INSERT INTO public.site_content(content_key,locale,status,value,is_machine_suggestion,updated_by,published_at,
              version)
   VALUES(p_key,p_locale,'published',v.value,false,auth.uid(),now(),
      COALESCE((SELECT max(version)+1 FROM public.site_content_history
                 WHERE content_key=p_key AND locale=p_locale),1))
   ON CONFLICT(content_key,locale,status)
    DO UPDATE SET value=EXCLUDED.value,is_machine_suggestion=false,updated_by=EXCLUDED.updated_by
   RETURNING * INTO v;
   DELETE FROM public.site_content
    WHERE content_key=p_key AND locale=p_locale AND status='draft';
 ELSIF p_operation='restore' THEN
   IF p_version IS NULL OR p_version<1 THEN
     RAISE EXCEPTION 'history_version_required' USING ERRCODE='22023';END IF;
   SELECT * INTO v_history FROM public.site_content_history
     WHERE content_key=p_key AND locale=p_locale AND version=p_version;
   IF NOT FOUND THEN RAISE EXCEPTION 'history_not_found' USING ERRCODE='22023';END IF;
   INSERT INTO public.site_content(content_key,locale,status,value,is_machine_suggestion,updated_by,published_at,
                                   version)
   VALUES(p_key,p_locale,'published',v_history.value,false,auth.uid(),now(),
      COALESCE((SELECT max(version)+1 FROM public.site_content_history
                 WHERE content_key=p_key AND locale=p_locale),1))
   ON CONFLICT(content_key,locale,status)
    DO UPDATE SET value=EXCLUDED.value,is_machine_suggestion=false,updated_by=EXCLUDED.updated_by
   RETURNING * INTO v;
 END IF;
 RETURN jsonb_build_object('ok',true,'operation',p_operation,'id',v.id,
    'key',v.content_key,'locale',v.locale,'status',v.status,'version',v.version);
END;
$body$;
REVOKE ALL ON FUNCTION public.kol_site_content_write_v1(text,text,text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kol_site_content_write_v1(text,text,text,text,integer) TO authenticated;

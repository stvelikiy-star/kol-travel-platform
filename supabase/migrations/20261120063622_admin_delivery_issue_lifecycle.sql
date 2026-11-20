-- KÖL audited courier issue lifecycle. No changes to payments, orders or delivery status.
-- Private SECURITY DEFINER function enforces its own actor role and transition rules.
-- Cold local Supabase only runs migration files; the full KÖL schema is later
-- restored in the dedicated production-shaped integration fixture. Do not
-- silently create incomplete operational tables in an empty local database.
DO $kol_lifecycle_install$
BEGIN
  IF to_regclass('public.delivery_issues') IS NULL OR
     to_regclass('public.audit_logs') IS NULL THEN
    RAISE NOTICE 'KOL_BASELINE_SCHEMA_NOT_INSTALLED__ISSUE_LIFECYCLE_SKIPPED';
    RETURN;
  END IF;
  IF to_regnamespace('private') IS NULL THEN
    RAISE EXCEPTION 'KOL_PRIVATE_SCHEMA_MISSING';
  END IF;
  EXECUTE $kol_ddl$
CREATE OR REPLACE FUNCTION private.admin_delivery_issue_transition_internal(
  p_issue_id uuid,
  p_to_status text,
  p_request_id text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $kol$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_issue record;
  v_prior record;
  v_actor_role text;
  v_from_status text;
BEGIN
  IF v_actor IS NULL OR NOT (
    public.has_role('super_admin')
    OR public.has_role('support_admin')
    OR public.has_role('dispatcher')
  ) THEN
    RAISE EXCEPTION 'delivery_issue_admin_access_denied' USING ERRCODE='42501';
  END IF;
  IF p_issue_id IS NULL OR p_to_status NOT IN ('open','in_review','resolved') THEN
    RAISE EXCEPTION 'invalid_delivery_issue_transition' USING ERRCODE='22023';
  END IF;
  IF p_request_id IS NULL OR length(p_request_id) < 8 OR length(p_request_id) > 128
     OR p_request_id !~ '^[A-Za-z0-9_:-]+$' THEN
    RAISE EXCEPTION 'invalid_delivery_issue_request_id' USING ERRCODE='22023';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 OR length(btrim(p_reason)) > 500 THEN
    RAISE EXCEPTION 'delivery_issue_reason_required' USING ERRCODE='22023';
  END IF;

  -- Prevent concurrent reuse of one idempotency key across different incidents.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text || ':delivery_issue:' || p_request_id, 0)
  );
  SELECT al.entity_id, al.after, al.reason
    INTO v_prior
    FROM public.audit_logs al
    WHERE al.actor_id=v_actor
      AND al.action='admin_delivery_issue_status_changed'
      AND al.request_id=p_request_id
    ORDER BY al.created_at DESC
    LIMIT 1;
  IF FOUND THEN
    IF v_prior.entity_id = p_issue_id AND v_prior.after->>'status' = p_to_status
       AND v_prior.reason = btrim(p_reason) THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok',true,'idempotent',true,'issue_id',p_issue_id,'status',p_to_status
      );
    END IF;
    RAISE EXCEPTION 'delivery_issue_request_id_conflict' USING ERRCODE='23505';
  END IF;

  SELECT * INTO v_issue FROM public.delivery_issues WHERE id=p_issue_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'delivery_issue_not_found' USING ERRCODE='P0002';
  END IF;
  v_from_status := v_issue.status;
  IF NOT (
    (v_from_status='open' AND p_to_status IN ('in_review','resolved'))
    OR (v_from_status='in_review' AND p_to_status IN ('open','resolved'))
    OR (v_from_status='resolved' AND p_to_status='open')
  ) THEN
    RAISE EXCEPTION 'invalid_delivery_issue_status_change' USING ERRCODE='22023';
  END IF;

  UPDATE public.delivery_issues
    SET status=p_to_status,updated_at=pg_catalog.clock_timestamp()
    WHERE id=p_issue_id;
  v_actor_role := CASE
    WHEN public.has_role('super_admin') THEN 'super_admin'
    WHEN public.has_role('support_admin') THEN 'support_admin'
    ELSE 'dispatcher' END;
  INSERT INTO public.audit_logs (
    actor_id,actor_role,action,entity_type,entity_id,
    "before","after",reason,request_id
  ) VALUES (
    v_actor,v_actor_role,'admin_delivery_issue_status_changed','delivery_issue',p_issue_id,
    pg_catalog.jsonb_build_object('status',v_from_status),
    pg_catalog.jsonb_build_object('status',p_to_status),
    btrim(p_reason),p_request_id
  );
  RETURN pg_catalog.jsonb_build_object(
    'ok',true,'idempotent',false,'issue_id',p_issue_id,'status',p_to_status
  );
END $kol$;
  $kol_ddl$;
  EXECUTE $kol_ddl$
REVOKE ALL ON FUNCTION private.admin_delivery_issue_transition_internal(uuid,text,text,text) FROM PUBLIC,anon;
  $kol_ddl$;
  EXECUTE $kol_ddl$
GRANT EXECUTE ON FUNCTION private.admin_delivery_issue_transition_internal(uuid,text,text,text) TO authenticated;
  $kol_ddl$;
  EXECUTE $kol_ddl$
CREATE OR REPLACE FUNCTION public.admin_delivery_issue_transition_atomic(
  p_issue_id uuid,
  p_to_status text,
  p_request_id text,
  p_reason text
)
RETURNS jsonb
LANGUAGE sql
SET search_path TO ''
AS $kol$
  SELECT private.admin_delivery_issue_transition_internal(
    p_issue_id,p_to_status,p_request_id,p_reason
  );
$kol$;
  $kol_ddl$;
  EXECUTE $kol_ddl$
REVOKE ALL ON FUNCTION public.admin_delivery_issue_transition_atomic(uuid,text,text,text) FROM PUBLIC,anon;
  $kol_ddl$;
  EXECUTE $kol_ddl$
GRANT EXECUTE ON FUNCTION public.admin_delivery_issue_transition_atomic(uuid,text,text,text) TO authenticated;
  $kol_ddl$;
END $kol_lifecycle_install$;

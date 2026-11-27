-- QA ONLY: run against the dedicated KÖL test database after migration 20261126133626.
-- All test data and temporary role/security changes roll back. No external calls.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='45s';
DO $target$
BEGIN
 IF to_regprocedure('public.admin_room_lifecycle_atomic(uuid,text,text,text)') IS NULL THEN
  RAISE EXCEPTION 'room_moderation_not_installed';
 END IF;
 IF has_function_privilege('anon','public.admin_room_lifecycle_atomic(uuid,text,text,text)','EXECUTE')
 OR has_table_privilege('authenticated','public.rooms','INSERT')
 OR has_table_privilege('authenticated','public.rooms','UPDATE')
 OR has_table_privilege('authenticated','public.rooms','DELETE') THEN
  RAISE EXCEPTION 'room_moderation_acl_unsafe';
 END IF;
END $target$;
CREATE TEMP TABLE qa_room_governance_context AS
SELECT
 (SELECT ur.user_id FROM public.user_roles ur JOIN public.user_profiles up ON up.user_id=ur.user_id
 WHERE ur.role='super_admin' AND ur.is_active AND up.status='active' LIMIT 1) AS admin_id,
 (SELECT r.id FROM public.rooms r JOIN public.stays s ON s.id=r.stay_id
 JOIN public.partners p ON p.id=r.business_id
 WHERE r.status='under_review' AND r.price_per_night>0 AND r.capacity>0
 AND s.status='active' AND p.status='approved' AND p.business_status='online'
 AND r.stay_id<>'41000000-0000-0000-0000-000000000001' LIMIT 1) AS review_room,
 ps.user_id AS partner_id,r.id AS partner_room,r.stay_id AS partner_stay,
 'qa-room-'||gen_random_uuid()::text AS req
FROM public.partner_staff ps JOIN public.rooms r ON r.business_id=ps.business_id
JOIN public.user_profiles up ON up.user_id=ps.user_id
WHERE ps.is_active AND up.status='active' AND r.status='active' AND r.price_per_night>0
AND EXISTS(SELECT 1 FROM public.user_roles ur WHERE ur.user_id=ps.user_id AND ur.is_active
 AND ur.role IN ('partner_owner','partner_manager','partner_staff')) LIMIT 1;
-- Temporary activation of the existing QA fixture only; no committed inventory.
UPDATE public.stays SET status='active' WHERE id=(SELECT partner_stay FROM qa_room_governance_context);
UPDATE private.kol_privileged_mfa_controls_v1 SET enabled=true WHERE singleton;
GRANT SELECT ON qa_room_governance_context TO authenticated;
SET LOCAL ROLE authenticated;
DO $qa$
DECLARE ctx record; result jsonb; date_id uuid;
BEGIN
 SELECT * INTO ctx FROM qa_room_governance_context;
 IF ctx.admin_id IS NULL OR ctx.review_room IS NULL OR ctx.partner_id IS NULL OR ctx.partner_room IS NULL
 THEN RAISE EXCEPTION 'missing QA fixtures'; END IF;
 PERFORM set_config('request.jwt.claim.sub',ctx.admin_id::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',ctx.admin_id,'role','authenticated','aal','aal1')::text,true);
 BEGIN
  PERFORM public.admin_room_lifecycle_atomic(ctx.review_room,'approve',ctx.req,'QA rollback test only');
  RAISE EXCEPTION 'MFA AAL1 incorrectly allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',ctx.admin_id,'role','authenticated','aal','aal2')::text,true);
 IF NOT EXISTS(SELECT 1 FROM public.rooms WHERE id=ctx.review_room) THEN RAISE EXCEPTION 'admin review read failed'; END IF;
 result:=public.admin_room_lifecycle_atomic(ctx.review_room,'approve',ctx.req,'QA rollback test only');
 IF result->>'status' IS DISTINCT FROM 'approved' THEN RAISE EXCEPTION 'approve failed'; END IF;
 result:=public.admin_room_lifecycle_atomic(ctx.review_room,'approve',ctx.req,'QA rollback test only');
 IF result->>'idempotent' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'duplicate failed'; END IF;
 result:=public.admin_room_lifecycle_atomic(ctx.review_room,'publish',ctx.req||'-publish','QA rollback test only');
 IF result->>'status' IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'publish failed'; END IF;
 result:=public.admin_room_lifecycle_atomic(ctx.review_room,'unpublish',ctx.req||'-unpublish','QA rollback test only');
 IF result->>'status' IS DISTINCT FROM 'approved' THEN RAISE EXCEPTION 'unpublish failed'; END IF;
 PERFORM set_config('request.jwt.claim.sub',ctx.partner_id::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',ctx.partner_id,'role','authenticated','aal','aal1')::text,true);
 IF NOT EXISTS(SELECT 1 FROM public.rooms WHERE id=ctx.partner_room) THEN RAISE EXCEPTION 'partner room read failed'; END IF;
 BEGIN
  PERFORM public.admin_room_lifecycle_atomic(ctx.review_room,'publish',ctx.req||'-denied','QA rollback test only');
  RAISE EXCEPTION 'partner moderation allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 result:=public.partner_inventory_publish_atomic('room_date',ctx.partner_room,current_date+31,NULL,2,NULL,ctx.req||'-inventory');
 IF result->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'inventory publish failed'; END IF;
 date_id:=(result->>'scope_id')::uuid;
 result:=public.partner_availability_action_atomic('room_date',date_id,'close',ctx.req||'-close','QA rollback test only');
 IF result->>'status' IS DISTINCT FROM 'closed' THEN RAISE EXCEPTION 'close failed'; END IF;
 result:=public.partner_availability_action_atomic('room_date',date_id,'open',ctx.req||'-open','QA rollback test only');
 IF result->>'status' IS DISTINCT FROM 'available' THEN RAISE EXCEPTION 'open failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.room_availability WHERE id=date_id AND available_count=2 AND status='available')
 THEN RAISE EXCEPTION 'inventory count failed'; END IF;
END $qa$;
RESET ROLE;
DO $audit$
DECLARE ctx record;
BEGIN
 SELECT * INTO ctx FROM qa_room_governance_context;
 IF (SELECT count(*) FROM public.audit_logs WHERE actor_id=ctx.admin_id
 AND request_id IN(ctx.req,ctx.req||'-publish',ctx.req||'-unpublish'))<>3 THEN
 RAISE EXCEPTION 'room moderation audit mismatch'; END IF;
 UPDATE public.user_profiles SET status='blocked' WHERE user_id=ctx.admin_id;
END $audit$;
SET LOCAL ROLE authenticated;
DO $blocked$
DECLARE ctx record;
BEGIN
 SELECT * INTO ctx FROM qa_room_governance_context;
 PERFORM set_config('request.jwt.claim.sub',ctx.admin_id::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',ctx.admin_id,'role','authenticated','aal','aal2')::text,true);
 BEGIN
  PERFORM public.admin_room_lifecycle_atomic(ctx.review_room,'publish',ctx.req||'-blocked','QA rollback test only');
  RAISE EXCEPTION 'blocked actor allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $blocked$;
RESET ROLE;
ROLLBACK;
SELECT 'KOL_ROOM_GOVERNANCE_QA_ROLLBACK_PASS' AS result;

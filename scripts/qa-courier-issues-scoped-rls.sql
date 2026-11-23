-- Destructive within transaction only. Must run on an isolated cloned PostgreSQL database.
BEGIN;
SET LOCAL statement_timeout = '25s';
-- KÖL: courier delivery-issue RLS hardening and scoped reads.
-- The existing courier INSERT policy allowed created_by to be forged on the courier's own delivery.
-- Admins retain their pre-existing ability to open incidents on behalf of others.
ALTER POLICY "couriers create delivery issues"
  ON public.delivery_issues
  WITH CHECK (
    public.is_admin()
    OR (
      created_by = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1
        FROM public.deliveries d
        WHERE d.id = delivery_issues.delivery_id
          AND public.is_assigned_courier(d.id)
      )
    )
  );

CREATE POLICY "courier owner or admin reads delivery issues"
  ON public.delivery_issues
  FOR SELECT
  TO authenticated
  USING (
    (created_by = (SELECT auth.uid()) AND public.has_role('courier'))
    OR public.is_admin()
  );


SELECT set_config('qa.delivery_id',(SELECT delivery_id::text FROM public.get_courier_active_deliveries() LIMIT 1),true)
WHERE false;
SELECT set_config('qa.courier_id',(SELECT user_id::text FROM public.user_roles WHERE role='courier' AND is_active LIMIT 1),true);
SELECT set_config('qa.admin_id',(SELECT user_id::text FROM public.user_roles WHERE role='super_admin' AND is_active LIMIT 1),true);
SELECT set_config('qa.delivery_id',(SELECT id::text FROM public.deliveries LIMIT 1),true);
SELECT set_config('request.jwt.claim.sub',current_setting('qa.courier_id'),true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.courier_id'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
INSERT INTO public.delivery_issues(delivery_id,category,priority,status,description,created_by)
VALUES(current_setting('qa.delivery_id')::uuid,'route_safety','high','open','KOL isolated courier issue RLS test',current_setting('qa.courier_id')::uuid);
DO $test$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.delivery_issues WHERE description='KOL isolated courier issue RLS test';
 IF n<>1 THEN RAISE EXCEPTION 'COURIER_CANNOT_READ_OWN_ISSUE'; END IF;
 RAISE NOTICE 'KOL_COURIER_ISSUE_INSERT_READ_PASS';
 BEGIN
   INSERT INTO public.delivery_issues(delivery_id,category,priority,status,description,created_by)
   VALUES(current_setting('qa.delivery_id')::uuid,'route_safety','high','open','SPOOFED AUTHOR',(SELECT user_id FROM public.user_roles WHERE role='client' LIMIT 1));
   RAISE EXCEPTION 'COURIER_AUTHOR_SPOOF_ALLOWED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM='COURIER_AUTHOR_SPOOF_ALLOWED' THEN RAISE; END IF;
   RAISE NOTICE 'KOL_COURIER_AUTHOR_SPOOF_DENIED_PASS';
 END;
END $test$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',(SELECT user_id::text FROM public.user_roles WHERE role='client' AND is_active LIMIT 1),true);
SELECT set_config('request.jwt.claims',(SELECT jsonb_build_object('sub',user_id,'role','authenticated')::text FROM public.user_roles WHERE role='client' AND is_active LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $test$
BEGIN
 IF EXISTS(SELECT 1 FROM public.delivery_issues WHERE description='KOL isolated courier issue RLS test') THEN
   RAISE EXCEPTION 'UNRELATED_CLIENT_CAN_READ_COURIER_ISSUE';
 END IF;
 RAISE NOTICE 'KOL_COURIER_ISSUE_FOREIGN_DENIAL_PASS';
END $test$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',current_setting('qa.admin_id'),true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.admin_id'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $test$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.delivery_issues WHERE description='KOL isolated courier issue RLS test') THEN
   RAISE EXCEPTION 'ADMIN_CANNOT_READ_COURIER_ISSUE';
 END IF;
 RAISE NOTICE 'KOL_ADMIN_DELIVERY_ISSUES_READ_PASS';
END $test$;
RESET ROLE;
ROLLBACK;
SELECT 'KOL_COURIER_DELIVERY_ISSUES_ROLLBACK_PASS';

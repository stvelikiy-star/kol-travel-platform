-- KÖL hosted RLS patch applies only where the baseline schema is installed.
-- A brand-new local Supabase instance intentionally has no KÖL application schema:
-- skip this patch and show a NOTICE, never create a partial fake schema.
-- Production already has the baseline and both operations are mandatory there.
DO $kol_issue_patch$
BEGIN
  IF to_regclass('public.delivery_issues') IS NULL THEN
    RAISE NOTICE 'KOL_BASELINE_SCHEMA_NOT_INSTALLED__ISSUE_RLS_SKIPPED';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='delivery_issues' AND policyname='couriers create delivery issues') THEN
    RAISE EXCEPTION 'KOL_DELIVERY_ISSUE_BASELINE_POLICY_MISSING';
  END IF;
  EXECUTE $kol_ddl$
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
  $kol_ddl$;
  EXECUTE $kol_ddl$
CREATE POLICY"courier owner or admin reads delivery issues"
  ON public.delivery_issues
  FOR SELECT
  TO authenticated
  USING (
    (created_by = (SELECT auth.uid()) AND public.has_role('courier'))
    OR public.is_admin()
  );
  $kol_ddl$;
END $kol_issue_patch$;

-- Harden direct REST inserts: courier cannot spoof an already resolved incident
-- or bypass the same category/priority/description rules as the server action.
-- Admin INSERT behavior remains unchanged.
DO $kol_issue_insert_hardening$
BEGIN
  IF to_regclass('public.delivery_issues') IS NULL THEN
    RAISE NOTICE 'KOL_BASELINE_SCHEMA_NOT_INSTALLED__ISSUE_INSERT_VALIDATION_SKIPPED';
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='delivery_issues'
      AND policyname='couriers create delivery issues'
  ) THEN
    RAISE EXCEPTION 'KOL_COURIER_ISSUE_INSERT_POLICY_MISSING';
  END IF;
  EXECUTE $ddl$
    ALTER POLICY "couriers create delivery issues"
      ON public.delivery_issues
      WITH CHECK (
        public.is_admin()
        OR (
          created_by = (SELECT auth.uid())
          AND status = 'open'
          AND category IN ('partner_pickup','client_address','damaged_order','route_safety','payment_admin')
          AND priority IN ('low','medium','high','critical')
          AND description IS NOT NULL
          AND pg_catalog.char_length(pg_catalog.btrim(description)) BETWEEN 12 AND 1000
          AND EXISTS (
            SELECT 1 FROM public.deliveries d
            WHERE d.id=delivery_issues.delivery_id
              AND public.is_assigned_courier(d.id)
          )
        )
      )
  $ddl$;
END $kol_issue_insert_hardening$;

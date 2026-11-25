-- KÖL P0: prevent a blocked user's still-valid JWT from accessing protected
-- PostgREST / Storage RLS rows directly. Browser route guards alone are insufficient.
-- Preserve user_profiles and user_roles self-read so /account-blocked keeps working.
-- Intentionally leaves anonymous/public catalog visibility unchanged.
-- No destructive DDL and no elevation of INSERT/UPDATE permissions.
DO $kol_blocked_rls$
DECLARE
  p record;
  ddl text;
  guarded_count integer;
  guard text := '(SELECT public.kol_active_actor_v1())';
BEGIN
  -- The clean local Supabase bootstrap intentionally contains no KÖL baseline.
  -- Do not create a partial schema; hosted and restored full baselines MUST pass.
  IF to_regclass('public.orders') IS NULL
      AND to_regclass('public.user_profiles') IS NULL THEN
    RAISE NOTICE 'KOL_BASELINE_SCHEMA_NOT_INSTALLED__BLOCKED_JWT_RLS_SKIPPED';
    RETURN;
  END IF;
  IF to_regclass('public.orders') IS NULL
      OR to_regclass('public.bookings') IS NULL
      OR to_regclass('public.user_profiles') IS NULL
      OR to_regclass('public.user_roles') IS NULL THEN
    RAISE EXCEPTION 'KOL_BASELINE_SCHEMA_PARTIAL__BLOCKED_JWT_RLS_REFUSED';
  END IF;

  EXECUTE $fn_definition$
    CREATE OR REPLACE FUNCTION public.kol_active_actor_v1()
    RETURNS boolean
    LANGUAGE sql STABLE SECURITY INVOKER
    SET search_path TO ''
    AS $body$
      SELECT EXISTS(
        SELECT 1
        FROM public.user_profiles AS profile
        JOIN public.user_roles AS user_role ON user_role.user_id=profile.user_id
        WHERE profile.user_id=(SELECT auth.uid())
          AND profile.status='active'
          AND user_role.is_active=TRUE
      );
    $body$;
  $fn_definition$;
  REVOKE ALL ON FUNCTION public.kol_active_actor_v1() FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.kol_active_actor_v1() TO authenticated;

  FOR p IN
    SELECT schemaname,tablename,policyname,cmd,qual,with_check
    FROM pg_catalog.pg_policies
    WHERE schemaname IN ('public','storage')
      AND roles=ARRAY['authenticated']::name[]
      AND NOT (schemaname='public' AND tablename IN ('user_profiles','user_roles'))
    ORDER BY schemaname,tablename,policyname
  LOOP
    IF coalesce(p.qual,'') LIKE '%kol_active_actor_v1%'
        OR coalesce(p.with_check,'') LIKE '%kol_active_actor_v1%' THEN
      CONTINUE;
    END IF;
    IF p.cmd IN ('SELECT','DELETE') THEN
      ddl:=format('ALTER POLICY %I ON %I.%I USING (%s AND (%s))',
        p.policyname,p.schemaname,p.tablename,guard,coalesce(p.qual,'true'));
    ELSIF p.cmd='INSERT' THEN
      ddl:=format('ALTER POLICY %I ON %I.%I WITH CHECK (%s AND (%s))',
        p.policyname,p.schemaname,p.tablename,guard,coalesce(p.with_check,'true'));
    ELSE
      ddl:=format('ALTER POLICY %I ON %I.%I USING (%s AND (%s)) WITH CHECK (%s AND (%s))',
        p.policyname,p.schemaname,p.tablename,guard,coalesce(p.qual,'true'),
        guard,coalesce(p.with_check,p.qual,'true'));
    END IF;
    EXECUTE ddl;
  END LOOP;
  SELECT count(*) INTO guarded_count
  FROM pg_catalog.pg_policies
  WHERE schemaname IN ('public','storage')
    AND (coalesce(qual,'') LIKE '%kol_active_actor_v1%'
         OR coalesce(with_check,'') LIKE '%kol_active_actor_v1%');
  IF guarded_count<80 THEN
    RAISE EXCEPTION 'KOL_BLOCKED_JWT_RLS_MISSING_BASELINE_POLICIES: %',guarded_count;
  END IF;
  RAISE NOTICE 'KOL_BLOCKED_JWT_RLS_ENABLED: % protected policies',guarded_count;
END $kol_blocked_rls$;

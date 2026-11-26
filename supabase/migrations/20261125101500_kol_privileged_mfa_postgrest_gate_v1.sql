-- KÖL: staged second-factor enforcement for direct PostgREST/RPC access.
-- This is safe on existing QA/Production identities: enforcement defaults OFF.
-- Do NOT turn it on until all privileged users enrolled TOTP and a tested recovery
-- path is available. Operational cutover requires separate approval.
DO $kol_privileged_mfa$
BEGIN
  IF to_regclass('public.orders') IS NULL AND to_regclass('public.user_profiles') IS NULL THEN
    RAISE NOTICE 'KOL_BASELINE_SCHEMA_NOT_INSTALLED__MFA_GATE_SKIPPED';
    RETURN;
  END IF;
  IF to_regprocedure('public.kol_active_actor_v1()') IS NULL OR
     to_regclass('public.user_roles') IS NULL OR
     to_regnamespace('private') IS NULL THEN
    RAISE EXCEPTION 'KOL_PRIVILEGED_MFA_REQUIRED_BASELINE_MISSING';
  END IF;

  EXECUTE $ddl$
    CREATE TABLE IF NOT EXISTS private.kol_privileged_mfa_controls_v1 (
      singleton boolean PRIMARY KEY DEFAULT TRUE CHECK (singleton),
      enabled boolean NOT NULL DEFAULT FALSE,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  $ddl$;
  EXECUTE $ddl$
    INSERT INTO private.kol_privileged_mfa_controls_v1(singleton,enabled)
    VALUES(TRUE,FALSE) ON CONFLICT(singleton) DO NOTHING;
  $ddl$;
  REVOKE ALL ON TABLE private.kol_privileged_mfa_controls_v1 FROM PUBLIC, anon, authenticated;

  -- The helper is definer-scoped to read the private control and role table.
  -- It returns only whether this *specific JWT* meets the configured policy.
  EXECUTE $ddl$
    CREATE OR REPLACE FUNCTION private.kol_privileged_mfa_ok_v1()
    RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
    AS $body$
      SELECT NOT (
        COALESCE((SELECT enabled FROM private.kol_privileged_mfa_controls_v1 WHERE singleton), FALSE)
        AND EXISTS(
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.is_active
            AND ur.role IN ('super_admin','finance_admin')
        )
        AND COALESCE(auth.jwt()->>'aal','') <> 'aal2'
      );
    $body$;
  $ddl$;
  REVOKE ALL ON FUNCTION private.kol_privileged_mfa_ok_v1() FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION private.kol_privileged_mfa_ok_v1() TO authenticated;

  -- Central actor check is already used in 86 protected public/Storage policies
  -- and ten guarded SECURITY DEFINER RPCs. Preserve active-role semantics.
  EXECUTE $ddl$
    CREATE OR REPLACE FUNCTION public.kol_active_actor_v1()
    RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO ''
    AS $body$
      SELECT EXISTS(
        SELECT 1 FROM public.user_profiles profile
        JOIN public.user_roles ur ON ur.user_id=profile.user_id
        WHERE profile.user_id=(SELECT auth.uid())
          AND profile.status='active' AND ur.is_active
      ) AND private.kol_privileged_mfa_ok_v1();
    $body$;
  $ddl$;
  REVOKE ALL ON FUNCTION public.kol_active_actor_v1() FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.kol_active_actor_v1() TO authenticated;

  IF has_table_privilege('authenticated', 'private.kol_privileged_mfa_controls_v1', 'UPDATE') OR
     has_table_privilege('anon', 'private.kol_privileged_mfa_controls_v1', 'UPDATE') THEN
    RAISE EXCEPTION 'KOL_PRIVILEGED_MFA_CONTROL_PUBLIC_WRITE_REFUSED';
  END IF;

  RAISE NOTICE 'KOL_PRIVILEGED_MFA_STAGED: private flag disabled; existing accounts unaffected';
END $kol_privileged_mfa$;

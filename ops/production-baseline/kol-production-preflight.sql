-- KÖL PRODUCTION preflight — READ ONLY. No schema mutation.
-- Only run after verifying the external connection/project ID equals
-- sggajelagfonzpovnsiz and is NOT the QA project mphruawzozrpwcjgejhs.
-- A safe empty target is necessary but not sufficient to authorize deployment.
DO $kol_production_empty$
DECLARE v_public integer; v_auth integer; v_buckets integer;
        v_objects integer; v_ledger integer := 0;
BEGIN
  SELECT count(*) INTO v_public FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE';
  SELECT count(*) INTO v_auth FROM auth.users;
  SELECT count(*) INTO v_buckets FROM storage.buckets;
  SELECT count(*) INTO v_objects FROM storage.objects;
  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM supabase_migrations.schema_migrations'
       INTO v_ledger;
  END IF;
  IF v_public<>0 OR v_auth<>0 OR v_buckets<>0
     OR v_objects<>0 OR v_ledger<>0 THEN
    RAISE EXCEPTION
      'KOL_PRODUCTION_PREFLIGHT_NOT_EMPTY public=% auth=% buckets=% objects=% ledger=%',
      v_public,v_auth,v_buckets,v_objects,v_ledger;
  END IF;
  IF current_setting('server_version_num')::integer < 170000 THEN
    RAISE EXCEPTION 'KOL_PRODUCTION_REQUIRES_POSTGRESQL_17';
  END IF;
  RAISE NOTICE 'KOL_PRODUCTION_EMPTY_TARGET_PREFLIGHT_PASS';
END
$kol_production_empty$;

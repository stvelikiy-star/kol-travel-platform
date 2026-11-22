-- KÖL isolated clean-schema postflight — READ ONLY.
-- Run on a freshly bootstrapped *disposable* Supabase first. No QA records.
-- Production execution is a separate controlled step after a reviewed replay.
DO $kol_production_postflight$
DECLARE v_public integer; v_rls integer; v_auth integer;
        v_objects integer; v_data integer; v_ai integer;
        v_indexes integer; v_email_triggers integer;
BEGIN
  SELECT count(*),count(*) FILTER (WHERE c.relrowsecurity)
    INTO v_public,v_rls
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r';
  SELECT count(*) INTO v_auth FROM auth.users;
  SELECT count(*) INTO v_objects FROM storage.objects;
  SELECT count(*) INTO v_data FROM (
      SELECT id FROM public.bookings UNION ALL
      SELECT id FROM public.orders UNION ALL
      SELECT id FROM public.payments UNION ALL
      SELECT id FROM public.rooms UNION ALL
      SELECT id FROM public.stays UNION ALL
      SELECT id FROM public.tours UNION ALL
      SELECT id FROM public.products
  ) d;
  SELECT count(*) INTO v_ai FROM information_schema.tables
    WHERE table_schema='public' AND table_name IN
      ('kol_ai_channels_v1','kol_ai_materials_v1','kol_ai_material_versions_v1');
  SELECT count(*) INTO v_indexes
    FROM pg_index i
    JOIN pg_class t ON t.oid=i.indrelid
    JOIN pg_class ix ON ix.oid=i.indexrelid
    WHERE t.relnamespace='public'::regnamespace
      AND (t.relname,ix.relname) IN
       (('kol_ai_channels_v1','idx_kol_ai_channels_v1_updated_by'),
        ('kol_ai_materials_v1','idx_kol_ai_materials_v1_updated_by'))
      AND i.indisvalid AND i.indisready
      AND i.indkey[0]=(
        SELECT attnum FROM pg_attribute
        WHERE attrelid=t.oid AND attname='updated_by');
  SELECT count(*) INTO v_email_triggers
    FROM pg_trigger g
    WHERE g.tgrelid='auth.users'::regclass
      AND g.tgname='kol_sync_auth_email_v1'
      AND NOT g.tgisinternal
      AND g.tgenabled<>'D';
  IF v_public<>72 OR v_rls<>72 OR v_auth<>0 OR v_objects<>0
     OR v_data<>0 OR v_ai<>3 OR v_indexes<>2 OR v_email_triggers<>1 THEN
    RAISE EXCEPTION
      'KOL_PRODUCTION_POSTFLIGHT_FAILED tables=% rls=% auth=% objects=% seed_rows=% ai_tables=% ai_fk_indexes=% email_triggers=%',
      v_public,v_rls,v_auth,v_objects,v_data,v_ai,v_indexes,v_email_triggers;
  END IF;
  RAISE NOTICE 'KOL_PRODUCTION_EMPTY_APP_SCHEMA_POSTFLIGHT_PASS';
END
$kol_production_postflight$;

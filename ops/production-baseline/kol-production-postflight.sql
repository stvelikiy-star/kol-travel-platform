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


-- Security invariant: production must reproduce the QA privileges, not the
-- broad default grants inherited by Supabase roles during schema-only restore.
DO $kol_postflight_acl$
DECLARE
 v_anon_definer integer;
 v_auth_definer integer;
 v_public_functions integer;
 v_column_scoped integer;
 v_unsafe_dml integer;
BEGIN
 SELECT count(*) FILTER (WHERE p.prosecdef AND has_function_privilege('anon',p.oid,'EXECUTE')),
        count(*) FILTER (WHERE p.prosecdef AND has_function_privilege('authenticated',p.oid,'EXECUTE')),
        count(*)
 INTO v_anon_definer,v_auth_definer,v_public_functions
 FROM pg_proc p WHERE p.pronamespace='public'::regnamespace;
 SELECT count(*) INTO v_column_scoped
 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
 WHERE c.relnamespace='public'::regnamespace AND a.attnum>0
 AND a.attacl IS NOT NULL;
 SELECT count(*) INTO v_unsafe_dml
 FROM information_schema.role_table_grants
 WHERE table_schema='public'
   AND grantee IN ('anon','authenticated')
   AND privilege_type IN ('INSERT','UPDATE','DELETE')
   AND table_name IN (
     'bookings','booking_status_history','orders','order_items',
     'order_status_history','payments','order_payments',
     'deliveries','order_delivery','courier_assignments',
     'delivery_status_history','audit_logs'
   );
 IF v_public_functions<>53 OR v_anon_definer<>2 OR v_auth_definer<>12
 OR v_column_scoped<>49 OR v_unsafe_dml<>0
 OR has_function_privilege('anon','public.kol_decide_finance_request_v1(uuid,text,uuid,text)','EXECUTE')
 OR has_function_privilege('authenticated','public.kol_decide_finance_request_v1(uuid,text,uuid,text)','EXECUTE')
 OR NOT has_function_privilege('service_role','public.kol_decide_finance_request_v1(uuid,text,uuid,text)','EXECUTE')
 OR has_sequence_privilege('anon','public.kol_ai_material_versions_v1_id_seq','USAGE')
 OR NOT has_sequence_privilege('authenticated','public.kol_ai_material_versions_v1_id_seq','USAGE')
 THEN
  RAISE EXCEPTION
    'KOL_PRODUCTION_ACL_PARITY_FAILED public_functions=% anon_definers=% auth_definers=% column_acls=% unsafe_dml=%',
    v_public_functions,v_anon_definer,v_auth_definer,v_column_scoped,v_unsafe_dml;
 END IF;
 RAISE NOTICE 'KOL_PRODUCTION_ACL_PARITY_POSTFLIGHT_PASS';
END
$kol_postflight_acl$;

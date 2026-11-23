-- KOL 045 Room lifecycle verified on isolated restored staging only.
-- READ ONLY. Do not use to approve any real commercial room.
DO $kol_room_verify$
DECLARE
  v_public_definer boolean;
  v_private_definer boolean;
BEGIN
  SELECT p.prosecdef INTO v_public_definer
  FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='admin_room_lifecycle_atomic'
    AND pg_catalog.pg_get_function_identity_arguments(p.oid)='p_room_id uuid, p_action text, p_request_id text, p_reason text';
  IF v_public_definer IS DISTINCT FROM false THEN
    RAISE EXCEPTION '045: public wrapper must be SECURITY INVOKER';
  END IF;

  SELECT p.prosecdef INTO v_private_definer
  FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='private' AND p.proname='admin_room_lifecycle_atomic_internal'
    AND pg_catalog.pg_get_function_identity_arguments(p.oid)='p_room_id uuid, p_action text, p_request_id text, p_reason text';
  IF v_private_definer IS DISTINCT FROM true THEN
    RAISE EXCEPTION '045: private implementation must be SECURITY DEFINER';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies p
    WHERE p.schemaname='public' AND p.tablename='rooms'
      AND p.policyname='super_admin reviews room lifecycle'
      AND p.cmd='SELECT' AND p.roles=array['authenticated']::name[]
      AND p.qual LIKE '%has_role(%super_admin%'
  ) THEN
    RAISE EXCEPTION '045: super_admin read policy missing or overly broad';
  END IF;
  IF pg_catalog.has_function_privilege('anon','public.admin_room_lifecycle_atomic(uuid,text,text,text)','EXECUTE')
     OR NOT pg_catalog.has_function_privilege('authenticated','public.admin_room_lifecycle_atomic(uuid,text,text,text)','EXECUTE') THEN
    RAISE EXCEPTION '045: incorrect RPC execution privileges';
  END IF;
  IF pg_catalog.has_table_privilege('anon','public.rooms','UPDATE')
     OR pg_catalog.has_table_privilege('authenticated','public.rooms','UPDATE')
     OR pg_catalog.has_table_privilege('authenticated','public.rooms','INSERT')
     OR pg_catalog.has_table_privilege('authenticated','public.rooms','DELETE') THEN
    RAISE EXCEPTION '045: direct room DML must remain denied';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.room_availability WHERE room_id IN (
      SELECT id FROM public.rooms
      WHERE stay_id='41000000-0000-0000-0000-000000000001'::uuid
    )
  ) THEN
    RAISE EXCEPTION '045: demo room has unexpected availability';
  END IF;
END
$kol_room_verify$;
select '045 ROOM LIFECYCLE SECURITY VERIFY PASS' as result;

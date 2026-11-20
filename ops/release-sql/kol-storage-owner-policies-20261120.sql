-- KÖL catalog-media policies. Privileged Supabase Storage owner operation ONLY.
-- TESTED: ROLLBACK dry run PASS under supabase_admin on isolated restored cloud clone.
-- HISTORICAL: the initial script required Storage-owner rights unavailable to the connected postgres role.
-- HOSTED STATUS (verified 2026-11-20): all five equivalent policies were installed manually via Supabase SQL Editor.
-- DO NOT RE-APPLY this fresh-install script to the hosted project. It intentionally refuses existing policies.
-- Use the read-only kol-storage-owner-verify-20261120.sql to verify hosted state.
-- Do not change owner of storage.objects or grant broad EXECUTE to anon.
-- Store this alongside the verified source: supabase/schema/009_catalog_media_storage_DRAFT_NOT_APPLIED.sql
BEGIN;
DO $kol_storage_preflight$
BEGIN
 IF (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='storage.objects'::regclass)
      <> 'supabase_storage_admin' THEN
   RAISE EXCEPTION 'Unexpected storage.objects owner';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM storage.buckets
     WHERE id='catalog-media' AND public=false AND file_size_limit=8388608) THEN
   RAISE EXCEPTION 'catalog-media bucket missing or wrong settings';
 END IF;
 IF (SELECT count(*) FROM pg_policies
     WHERE schemaname='storage' AND tablename='objects'
       AND policyname LIKE 'catalog media%') <> 0 THEN
   RAISE EXCEPTION 'Existing catalog media policies require manual review';
 END IF;
END $kol_storage_preflight$;

-- ---------------------------------------------------------------------------
-- Current Supabase Storage operation-aware helpers are used so anon SELECT does
-- not accidentally become bucket listing permission.






create policy "catalog media public signed reads"
on storage.objects
for select
to anon
using (
  bucket_id = 'catalog-media'
  and storage.allow_any_operation(array[
    'storage.object.sign',
    'storage.object.sign_many',
    'storage.object.get_authenticated',
    'storage.render.image_authenticated'
  ])
  and exists (
    select 1
    from public.media_files mf
    where mf.storage_bucket = 'catalog-media'
      and mf.storage_path = storage.objects.name
      and private.catalog_media_path_matches(mf.storage_path, mf.owner_type, mf.owner_id)
      and private.catalog_media_owner_is_public(mf.owner_type, mf.owner_id)
  )
);

create policy "catalog media partner reads"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'catalog-media'
  and (
    private.catalog_media_partner_can_manage(name)
    or exists (
      select 1
      from public.media_files mf
      where mf.storage_bucket = 'catalog-media'
        and mf.storage_path = storage.objects.name
        and private.catalog_media_path_matches(mf.storage_path, mf.owner_type, mf.owner_id)
        and private.catalog_media_owner_is_public(mf.owner_type, mf.owner_id)
    )
  )
);

create policy "catalog media partner uploads"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'catalog-media'
  and pg_catalog.lower(storage.extension(name)) in ('jpg','jpeg','png','webp','avif')
  and private.catalog_media_partner_can_manage(name)
);

create policy "catalog media partner updates"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'catalog-media'
  and private.catalog_media_partner_can_manage(name)
)
with check (
  bucket_id = 'catalog-media'
  and pg_catalog.lower(storage.extension(name)) in ('jpg','jpeg','png','webp','avif')
  and private.catalog_media_partner_can_manage(name)
);

create policy "catalog media partner deletes"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'catalog-media'
  and private.catalog_media_partner_can_manage(name)
);
COMMIT;

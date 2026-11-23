-- KÖL Production catalog-media private empty bucket and identical QA Storage RLS.
-- Verified baseline: 8 MiB; JPEG/PNG/WebP/AVIF; NO object bytes, NO public bucket.
-- Only for a 72-table empty Production with no users or catalog records.
BEGIN;
DO $kol_storage_preflight$
BEGIN
 IF (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE')<>72
 OR (SELECT count(*) FROM auth.users)<>0
 OR (SELECT count(*) FROM storage.objects)<>0
 OR EXISTS (SELECT 1 FROM storage.buckets WHERE id='catalog-media')
 OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'catalog media%')
 THEN RAISE EXCEPTION 'KOL_PRODUCTION_STORAGE_NOT_EMPTY_OR_WRONG_TARGET';
 END IF;
END;
$kol_storage_preflight$;

INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
 VALUES ('catalog-media','catalog-media',false,8388608,ARRAY['image/jpeg','image/png','image/webp','image/avif']::text[]);

CREATE POLICY "catalog media partner deletes" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
 USING (((bucket_id = 'catalog-media'::text) AND private.catalog_media_partner_can_manage(name)))
;

CREATE POLICY "catalog media partner reads r2e7u8_0" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
 USING (((bucket_id = 'catalog-media'::text) AND (private.catalog_media_partner_can_manage(name) OR (EXISTS ( SELECT 1
   FROM media_files mf
  WHERE ((mf.storage_bucket = 'catalog-media'::text) AND (mf.storage_path = objects.name) AND private.catalog_media_path_matches(mf.storage_path, mf.owner_type, mf.owner_id) AND private.catalog_media_owner_is_public(mf.owner_type, mf.owner_id)))))))
;

CREATE POLICY "catalog media partner updates" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
 USING (((bucket_id = 'catalog-media'::text) AND private.catalog_media_partner_can_manage(name)))
 WITH CHECK (((bucket_id = 'catalog-media'::text) AND (lower(storage.extension(name)) = ANY (ARRAY['jpg'::text, 'jpeg'::text, 'png'::text, 'webp'::text, 'avif'::text])) AND private.catalog_media_partner_can_manage(name)))
;

CREATE POLICY "catalog media partner uploads r2e7u8_0" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
 WITH CHECK (((bucket_id = 'catalog-media'::text) AND (lower(storage.extension(name)) = ANY (ARRAY['jpg'::text, 'jpeg'::text, 'png'::text, 'webp'::text, 'avif'::text])) AND private.catalog_media_partner_can_manage(name)))
;

CREATE POLICY "catalog media public signed reads r2e7u8_0" ON storage.objects AS PERMISSIVE FOR SELECT TO anon
 USING (((bucket_id = 'catalog-media'::text) AND storage.allow_any_operation(ARRAY['storage.object.sign'::text, 'storage.object.sign_many'::text, 'storage.object.get_authenticated'::text, 'storage.render.image_authenticated'::text]) AND (EXISTS ( SELECT 1
   FROM media_files mf
  WHERE ((mf.storage_bucket = 'catalog-media'::text) AND (mf.storage_path = objects.name) AND private.catalog_media_path_matches(mf.storage_path, mf.owner_type, mf.owner_id) AND private.catalog_media_owner_is_public(mf.owner_type, mf.owner_id))))))
;

COMMIT;

-- KÖL read-only verification: hosted catalog-media Storage policies.
-- Run with ordinary SQL read permission; does not modify storage.objects.
DO $kol_storage_verify$
DECLARE
  actual_count integer;
  matched_count integer;
BEGIN
  SELECT count(*) INTO actual_count
  FROM pg_policies
  WHERE schemaname='storage' AND tablename='objects'
    AND policyname LIKE 'catalog media%';

  WITH expected(policyname, command, target_role, requires_using, requires_check) AS (
    VALUES
      ('catalog media public signed reads r2e7u8_0','SELECT','{anon}',true,false),
      ('catalog media partner reads r2e7u8_0','SELECT','{authenticated}',true,false),
      ('catalog media partner uploads r2e7u8_0','INSERT','{authenticated}',false,true),
      ('catalog media partner updates','UPDATE','{authenticated}',true,true),
      ('catalog media partner deletes','DELETE','{authenticated}',true,false)
  )
  SELECT count(*) INTO matched_count
  FROM expected e
  JOIN pg_policies p
    ON p.policyname=e.policyname AND p.cmd=e.command AND p.roles::text=e.target_role
   AND p.schemaname='storage' AND p.tablename='objects'
   AND (p.qual IS NOT NULL)=e.requires_using
   AND (p.with_check IS NOT NULL)=e.requires_check
  WHERE coalesce(p.qual,'')||coalesce(p.with_check,'') LIKE '%catalog-media%'
    AND (
      e.policyname LIKE '%public signed reads%'
      OR coalesce(p.qual,'')||coalesce(p.with_check,'') LIKE '%catalog_media_partner_can_manage%'
    );

  IF actual_count<>5 OR matched_count<>5 THEN
    RAISE EXCEPTION 'catalog_media_storage_policy_mismatch: actual %, expected matches %',
      actual_count,matched_count;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id='catalog-media' AND public=false
      AND file_size_limit=8388608
      AND allowed_mime_types @> ARRAY['image/jpeg','image/png','image/webp','image/avif']::text[]
  ) THEN
    RAISE EXCEPTION 'catalog_media_storage_bucket_mismatch';
  END IF;
  RAISE NOTICE 'KOL_CATALOG_MEDIA_HOSTED_STORAGE_5_OF_5_PASS';
END $kol_storage_verify$;

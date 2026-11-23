-- KÖL editor-managed visuals: apply to isolated QA first, after 046A/046C.
-- Never run against Production before independent backup/restore approval.
-- This adds a distinct public IMAGE bucket; it does not change catalog-media.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('site-visuals', 'site-visuals', true, 4194304,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE
 SET public=EXCLUDED.public, file_size_limit=EXCLUDED.file_size_limit,
     allowed_mime_types=EXCLUDED.allowed_mime_types;

-- No user can overwrite/delete uploaded images; published history keeps its URL.
-- Auth and active-role checks run through the existing fail-closed content gate.
DROP POLICY IF EXISTS "kol site visuals editor upload" ON storage.objects;
CREATE POLICY "kol site visuals editor upload" ON storage.objects
 FOR INSERT TO authenticated
 WITH CHECK (bucket_id='site-visuals' AND private.can_manage_content()
   AND name ~ '^(background|banner)/[0-9a-f-]{36}[.](jpg|png|webp)$');

-- Public access is controlled by bucket visibility; no broad write grants.

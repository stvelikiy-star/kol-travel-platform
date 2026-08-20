-- KÖL / kol-travel-platform
-- CATALOG MEDIA uploaded_by FK index hardening — DRAFT NOT APPLIED
-- Prepared: 2026-08-21
--
-- Depends on 009_catalog_media_storage_DRAFT_NOT_APPLIED.sql.
-- 009 adds public.media_files.uploaded_by -> auth.users(id) after the earlier
-- 010 FK-index baseline has already run. Keep the complete 005→012b staging
-- sequence at zero missing leading indexes by indexing that later-added FK.
--
-- Source/staging only. Do not apply to live without the accepted backup,
-- baseline and staging gates.

begin;

create index if not exists idx_media_files_uploaded_by
on public.media_files (uploaded_by);

commit;

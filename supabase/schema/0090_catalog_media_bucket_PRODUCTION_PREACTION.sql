-- KÖL / kol-travel-platform
-- Production pre-action for migration 009.
-- Creates the required catalog-media bucket using the SQL method documented by Supabase.
-- Safe contract:
--   id/name = catalog-media
--   private
--   8 MiB max object size
--   JPEG/PNG/WebP/AVIF only
--
-- This script is intentionally fail-closed:
-- - if the bucket is absent, it creates it with the exact contract;
-- - if the bucket already exists and matches, it is a no-op;
-- - if the bucket exists with any different contract, it aborts without changing it.
--
-- Run only AFTER a verified live backup/restore rehearsal and immediately BEFORE
-- supabase/schema/009_catalog_media_storage_DRAFT_NOT_APPLIED.sql.

begin;

do $catalog_media_bucket$
declare
  v_public boolean;
  v_limit bigint;
  v_mimes text[];
  v_expected text[] := array['image/jpeg','image/png','image/webp','image/avif']::text[];
begin
  select b.public, b.file_size_limit, b.allowed_mime_types
    into v_public, v_limit, v_mimes
  from storage.buckets as b
  where b.id = 'catalog-media';

  if found then
    if not exists (
      select 1
      from storage.buckets as b
      where b.id = 'catalog-media'
        and b.name = 'catalog-media'
        and b.public is false
        and b.file_size_limit = 8388608
        and b.allowed_mime_types is not null
        and b.allowed_mime_types @> v_expected
        and v_expected @> b.allowed_mime_types
        and coalesce(b.type::text, 'STANDARD') = 'STANDARD'
    ) then
      raise exception 'catalog_media_bucket_exists_with_wrong_contract'
        using errcode = '55000';
    end if;

    return;
  end if;

  insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types,
    type
  ) values (
    'catalog-media',
    'catalog-media',
    false,
    8388608,
    v_expected,
    'STANDARD'::storage.buckettype
  );

  if not exists (
    select 1
    from storage.buckets as b
    where b.id = 'catalog-media'
      and b.name = 'catalog-media'
      and b.public is false
      and b.file_size_limit = 8388608
      and b.allowed_mime_types is not null
      and b.allowed_mime_types @> v_expected
      and v_expected @> b.allowed_mime_types
      and coalesce(b.type::text, 'STANDARD') = 'STANDARD'
  ) then
    raise exception 'catalog_media_bucket_create_verification_failed'
      using errcode = '55000';
  end if;
end
$catalog_media_bucket$;

commit;

select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  type::text as bucket_type
from storage.buckets
where id = 'catalog-media';

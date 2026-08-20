-- KÖL / kol-travel-platform
-- CATALOG MEDIA + SUPABASE STORAGE CORE — DRAFT NOT APPLIED
-- Prepared: 2026-08-20
-- Depends on staged 005 + 006 RLS baseline.
--
-- Live facts at preparation time:
-- - storage.buckets: 0 rows
-- - storage.objects policies: 0
-- - public.media_files: 0 rows
-- - media_files currently has owner_type, owner_id, url, alt, sort_order only
--
-- Design:
-- - one PRIVATE bucket: catalog-media
-- - image-only, 8 MiB object limit, SVG intentionally excluded
-- - canonical path: <business_uuid>/<owner_type>/<owner_uuid>/<random-file>
-- - owner_type for this contour: menu_item | product | tour | stay
-- - public catalog can sign/read only media whose catalog owner is active and whose
--   business partner is approved
-- - authenticated partner staff can manage only paths that resolve to their business
-- - storage object ownership is business-scoped, not uploader-only, so another active
--   staff member of the same business can manage the media later
-- - service role is not required by the application upload flow
--
-- No live apply before backup + migration baseline + staging role tests.

begin;

-- ---------------------------------------------------------------------------
-- 1. Private bucket with hard upload restrictions
-- ---------------------------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'catalog-media',
  'catalog-media',
  false,
  8388608,
  array['image/jpeg','image/png','image/webp','image/avif']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = pg_catalog.now();

-- ---------------------------------------------------------------------------
-- 2. media_files becomes Storage-aware
-- ---------------------------------------------------------------------------
-- url is no longer an authoritative permanent URL for private objects. Signed URLs
-- are generated at read time. Keep url only for compatibility/external-media future.

alter table public.media_files
  alter column url drop not null,
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint,
  add column if not exists uploaded_by uuid references auth.users(id) on delete set null;

update public.media_files
set storage_bucket = coalesce(storage_bucket, 'catalog-media')
where storage_path is not null;

create unique index if not exists uq_media_files_storage_object
on public.media_files (storage_bucket, storage_path)
where storage_bucket is not null and storage_path is not null;

create index if not exists idx_media_files_owner
on public.media_files (owner_type, owner_id, sort_order);

-- ---------------------------------------------------------------------------
-- 3. Non-exposed helper schema for safe Storage policy lookups
-- ---------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
grant usage on schema private to anon, authenticated;

-- Returns the authoritative business for a supported catalog owner.
create or replace function private.catalog_media_owner_business(
  p_owner_type text,
  p_owner_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
begin
  case p_owner_type
    when 'menu_item' then
      select m.business_id into v_business_id
      from public.menu_items as m where m.id = p_owner_id;
    when 'product' then
      select p.business_id into v_business_id
      from public.products as p where p.id = p_owner_id;
    when 'tour' then
      select t.business_id into v_business_id
      from public.tours as t where t.id = p_owner_id;
    when 'stay' then
      select s.business_id into v_business_id
      from public.stays as s where s.id = p_owner_id;
    else
      return null;
  end case;

  return v_business_id;
end;
$$;

-- Public visibility is intentionally a tiny boolean capability: active catalog owner
-- + approved parent partner. It does not disclose private row contents.
create or replace function private.catalog_media_owner_is_public(
  p_owner_type text,
  p_owner_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_visible boolean := false;
begin
  v_business_id := private.catalog_media_owner_business(p_owner_type, p_owner_id);
  if v_business_id is null then
    return false;
  end if;

  case p_owner_type
    when 'menu_item' then
      select exists(
        select 1 from public.menu_items m
        where m.id = p_owner_id and m.business_id = v_business_id and m.status = 'active'
      ) into v_visible;
    when 'product' then
      select exists(
        select 1 from public.products p
        where p.id = p_owner_id and p.business_id = v_business_id and p.status = 'active'
      ) into v_visible;
    when 'tour' then
      select exists(
        select 1 from public.tours t
        where t.id = p_owner_id and t.business_id = v_business_id and t.status = 'active'
      ) into v_visible;
    when 'stay' then
      select exists(
        select 1 from public.stays s
        where s.id = p_owner_id and s.business_id = v_business_id and s.status = 'active'
      ) into v_visible;
    else
      return false;
  end case;

  if not v_visible then
    return false;
  end if;

  return exists(
    select 1 from public.partners p
    where p.id = v_business_id and p.status = 'approved'
  );
end;
$$;

-- Validates that path and metadata identify the same authoritative catalog row.
create or replace function private.catalog_media_path_matches(
  p_path text,
  p_owner_type text,
  p_owner_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_folders text[];
  v_business_id uuid;
begin
  if p_path is null or p_owner_type is null or p_owner_id is null then
    return false;
  end if;

  v_folders := storage.foldername(p_path);
  if pg_catalog.array_length(v_folders, 1) <> 3 then
    return false;
  end if;

  if v_folders[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or v_folders[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  if v_folders[2] <> p_owner_type or v_folders[3]::uuid <> p_owner_id then
    return false;
  end if;

  v_business_id := private.catalog_media_owner_business(p_owner_type, p_owner_id);
  return v_business_id is not null and v_folders[1]::uuid = v_business_id;
end;
$$;

-- Validates active partner/admin management of an object path.
create or replace function private.catalog_media_partner_can_manage(
  p_path text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_folders text[];
  v_business_id uuid;
  v_owner_id uuid;
  v_owner_type text;
begin
  if v_user_id is null or p_path is null then
    return false;
  end if;

  v_folders := storage.foldername(p_path);
  if pg_catalog.array_length(v_folders, 1) <> 3 then
    return false;
  end if;

  if v_folders[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or v_folders[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  v_business_id := v_folders[1]::uuid;
  v_owner_type := v_folders[2];
  v_owner_id := v_folders[3]::uuid;

  if private.catalog_media_owner_business(v_owner_type, v_owner_id) is distinct from v_business_id then
    return false;
  end if;

  return exists(
    select 1 from public.partner_staff ps
    where ps.business_id = v_business_id
      and ps.user_id = v_user_id
      and ps.is_active = true
  ) or exists(
    select 1 from public.user_roles ur
    where ur.user_id = v_user_id
      and ur.role = 'super_admin'
      and ur.is_active = true
  );
end;
$$;

revoke all on function private.catalog_media_owner_business(text,uuid) from public;
revoke all on function private.catalog_media_owner_is_public(text,uuid) from public;
revoke all on function private.catalog_media_path_matches(text,text,uuid) from public;
revoke all on function private.catalog_media_partner_can_manage(text) from public;

grant execute on function private.catalog_media_owner_is_public(text,uuid) to anon, authenticated;
grant execute on function private.catalog_media_path_matches(text,text,uuid) to authenticated;
grant execute on function private.catalog_media_partner_can_manage(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. media_files metadata RLS
-- ---------------------------------------------------------------------------

grant select on table public.media_files to anon;
grant select, insert, update, delete on table public.media_files to authenticated;

drop policy if exists "admins read media metadata" on public.media_files;
drop policy if exists "public reads visible catalog media metadata" on public.media_files;
drop policy if exists "partners read own catalog media metadata" on public.media_files;
drop policy if exists "partners create own catalog media metadata" on public.media_files;
drop policy if exists "partners update own catalog media metadata" on public.media_files;
drop policy if exists "partners delete own catalog media metadata" on public.media_files;

create policy "public reads visible catalog media metadata"
on public.media_files
for select
to anon
using (
  storage_bucket = 'catalog-media'
  and storage_path is not null
  and private.catalog_media_path_matches(storage_path, owner_type, owner_id)
  and private.catalog_media_owner_is_public(owner_type, owner_id)
);

create policy "partners read own catalog media metadata"
on public.media_files
for select
to authenticated
using (
  (
    storage_bucket = 'catalog-media'
    and storage_path is not null
    and private.catalog_media_path_matches(storage_path, owner_type, owner_id)
    and private.catalog_media_partner_can_manage(storage_path)
  )
  or private.catalog_media_owner_is_public(owner_type, owner_id)
  or public.is_admin()
);

create policy "partners create own catalog media metadata"
on public.media_files
for insert
to authenticated
with check (
  storage_bucket = 'catalog-media'
  and storage_path is not null
  and uploaded_by = (select auth.uid())
  and mime_type in ('image/jpeg','image/png','image/webp','image/avif')
  and size_bytes between 1 and 8388608
  and private.catalog_media_path_matches(storage_path, owner_type, owner_id)
  and private.catalog_media_partner_can_manage(storage_path)
);

create policy "partners update own catalog media metadata"
on public.media_files
for update
to authenticated
using (
  storage_bucket = 'catalog-media'
  and storage_path is not null
  and private.catalog_media_partner_can_manage(storage_path)
)
with check (
  storage_bucket = 'catalog-media'
  and storage_path is not null
  and mime_type in ('image/jpeg','image/png','image/webp','image/avif')
  and size_bytes between 1 and 8388608
  and private.catalog_media_path_matches(storage_path, owner_type, owner_id)
  and private.catalog_media_partner_can_manage(storage_path)
);

create policy "partners delete own catalog media metadata"
on public.media_files
for delete
to authenticated
using (
  storage_bucket = 'catalog-media'
  and storage_path is not null
  and private.catalog_media_path_matches(storage_path, owner_type, owner_id)
  and private.catalog_media_partner_can_manage(storage_path)
);

-- ---------------------------------------------------------------------------
-- 5. Storage object RLS
-- ---------------------------------------------------------------------------
-- Private bucket: signed URL creation/read requires SELECT. Public catalog gets only
-- sign/get operations, not object listing. Partner access adds list + management.

drop policy if exists "catalog media public signed reads" on storage.objects;
drop policy if exists "catalog media partner reads" on storage.objects;
drop policy if exists "catalog media partner uploads" on storage.objects;
drop policy if exists "catalog media partner updates" on storage.objects;
drop policy if exists "catalog media partner deletes" on storage.objects;

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
  and storage.extension(name) in ('jpg','jpeg','png','webp','avif')
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
  and storage.extension(name) in ('jpg','jpeg','png','webp','avif')
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

commit;

-- REQUIRED STAGING PROOF
-- 1. bucket exists, public=false, size=8MiB, MIME allowlist exact.
-- 2. anon cannot list bucket contents.
-- 3. anon can create signed URL/read only when matching media_files row points to
--    active catalog item under approved partner.
-- 4. anon cannot sign inactive/unapproved/orphan objects.
-- 5. partner A can upload/read/delete only media for owner rows in partner A business.
-- 6. partner A cannot forge business/type/owner path for partner B.
-- 7. SVG/executable/non-image and >8MiB upload rejected.
-- 8. upsert test requires INSERT + SELECT + UPDATE and remains partner-scoped.
-- 9. metadata failure after object upload is cleaned up by the server action.
-- 10. no service-role key appears in browser/client code.

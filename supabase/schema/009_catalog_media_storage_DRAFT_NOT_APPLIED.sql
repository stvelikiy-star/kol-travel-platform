-- KÖL / kol-travel-platform
-- CATALOG MEDIA + SUPABASE STORAGE CORE V2 — DRAFT NOT APPLIED
-- Prepared: 2026-08-20
-- Depends on staged 005 + 006 RLS baseline.
--
-- Live facts re-verified before this restack:
-- - storage.buckets: 0 rows
-- - storage.objects: 0 rows
-- - storage.objects policies: 0
-- - public.media_files: 0 rows
-- - media_files currently has owner_type, owner_id, url, alt, sort_order only
--
-- IMPORTANT STORAGE BOUNDARY:
-- - this migration does NOT INSERT/UPDATE/DELETE storage.buckets;
-- - provision the private catalog-media bucket through Supabase Storage API first;
-- - this migration fails closed unless the exact bucket contract already exists;
-- - object bytes are always created/deleted through Storage API, never SQL.
--
-- Bucket contract:
-- - id/name: catalog-media
-- - private
-- - 8 MiB object limit
-- - JPEG/PNG/WebP/AVIF only; SVG intentionally excluded
--
-- Canonical object path:
--   <business_uuid>/<owner_type>/<owner_uuid>/<random-file>
-- owner_type: menu_item | product | tour | stay
--
-- No live apply before logical backup + accepted migration baseline + staging role tests.

begin;

-- ---------------------------------------------------------------------------
-- 1. Fail-fast Storage API provisioning precondition
-- ---------------------------------------------------------------------------

do $bucket_contract$
declare
  v_public boolean;
  v_limit bigint;
  v_mimes text[];
  v_expected text[] := array['image/jpeg','image/png','image/webp','image/avif']::text[];
begin
  select b.public, b.file_size_limit, b.allowed_mime_types
    into v_public, v_limit, v_mimes
  from storage.buckets as b
  where b.id = 'catalog-media'
    and b.name = 'catalog-media';

  if not found then
    raise exception 'catalog_media_bucket_missing_run_storage_api_provisioner'
      using errcode = '55000';
  end if;

  if v_public is distinct from false
     or v_limit is distinct from 8388608
     or v_mimes is null
     or not (v_mimes @> v_expected and v_expected @> v_mimes) then
    raise exception 'catalog_media_bucket_contract_mismatch'
      using errcode = '55000';
  end if;
end
$bucket_contract$;

-- ---------------------------------------------------------------------------
-- 2. media_files becomes Storage-aware
-- ---------------------------------------------------------------------------
-- url is not authoritative for private objects. Signed URLs are generated at read
-- time. Keep url nullable for compatibility/external-media future.

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
-- 3. Non-exposed helper schema for Storage/media policy lookups
-- ---------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
grant usage on schema private to anon, authenticated;

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
        where m.id = p_owner_id
          and m.business_id = v_business_id
          and m.status = 'active'
      ) into v_visible;
    when 'product' then
      select exists(
        select 1 from public.products p
        where p.id = p_owner_id
          and p.business_id = v_business_id
          and p.status = 'active'
      ) into v_visible;
    when 'tour' then
      select exists(
        select 1 from public.tours t
        where t.id = p_owner_id
          and t.business_id = v_business_id
          and t.status = 'active'
      ) into v_visible;
    when 'stay' then
      select exists(
        select 1 from public.stays s
        where s.id = p_owner_id
          and s.business_id = v_business_id
          and s.status = 'active'
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
     or v_folders[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
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

-- SECURITY DEFINER helpers are intentionally private-schema functions. Remove
-- default PUBLIC execute and expose only the minimum calls required by policies.
revoke all on function private.catalog_media_owner_business(text,uuid) from public;
revoke all on function private.catalog_media_owner_is_public(text,uuid) from public;
revoke all on function private.catalog_media_path_matches(text,text,uuid) from public;
revoke all on function private.catalog_media_partner_can_manage(text) from public;

grant execute on function private.catalog_media_owner_is_public(text,uuid) to anon, authenticated;
grant execute on function private.catalog_media_path_matches(text,text,uuid) to anon, authenticated;
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
  or (
    storage_bucket = 'catalog-media'
    and storage_path is not null
    and private.catalog_media_path_matches(storage_path, owner_type, owner_id)
    and private.catalog_media_owner_is_public(owner_type, owner_id)
  )
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
-- Current Supabase Storage operation-aware helpers are used so anon SELECT does
-- not accidentally become bucket listing permission.

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

commit;

-- REQUIRED STAGING PROOF
-- 1. Provisioner creates/updates exact private 8MiB MIME-restricted bucket via API.
-- 2. Migration refuses to run if bucket is absent or misconfigured.
-- 3. anon cannot list bucket contents.
-- 4. anon can sign/read only matching metadata for active catalog under approved partner.
-- 5. anon cannot sign inactive/unapproved/orphan objects.
-- 6. Partner A can upload/read/delete only media for owners in business A.
-- 7. Partner A cannot forge business/type/owner path for partner B.
-- 8. SVG/executable/non-image and >8MiB upload is rejected.
-- 9. upsert requires INSERT + SELECT + UPDATE and remains partner-scoped.
-- 10. metadata failure after upload triggers Storage API cleanup.
-- 11. no service-role key appears in browser/client code.

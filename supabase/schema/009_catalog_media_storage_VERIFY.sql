-- KÖL / 009 catalog media storage v2 verification
-- READ-ONLY. Run after Storage API bucket provisioning + staged SQL apply.

-- 1. Bucket contract created through Storage API, not this SQL migration.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'catalog-media';

-- Expected exactly one row:
-- public=false
-- file_size_limit=8388608
-- MIME set = image/jpeg,image/png,image/webp,image/avif

-- 2. Media metadata columns/indexes.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public' and table_name='media_files'
order by ordinal_position;

select indexname, indexdef
from pg_catalog.pg_indexes
where schemaname='public' and tablename='media_files'
order by indexname;

-- 3. Private helper hardening.
select n.nspname as schema_name, p.proname, p.prosecdef as security_definer, p.proconfig,
  pg_catalog.has_function_privilege('public', p.oid, 'EXECUTE') as public_execute,
  pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='private' and p.proname like 'catalog_media_%'
order by p.proname;

-- 4. media_files policies.
select policyname, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname='public' and tablename='media_files'
order by policyname;

-- 5. Storage object policies.
select policyname, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname='storage' and tablename='objects'
  and policyname like 'catalog media%'
order by policyname;

-- 6. Bucket must never be public.
select count(*) as public_catalog_media_buckets
from storage.buckets
where id='catalog-media' and public=true;

-- 7. Integrity snapshot before staged fixtures.
select
  (select count(*) from storage.objects where bucket_id='catalog-media') as objects,
  (select count(*) from public.media_files where storage_bucket='catalog-media') as metadata_rows;

-- Required staging role scenarios:
-- A. Provisioner read-only check reports exact bucket contract.
-- B. Partner A valid upload => PASS; partner B path/owner forgery => DENY.
-- C. SVG/non-image/>8MiB => DENY.
-- D. Inactive/unapproved owner anon metadata/sign => DENY.
-- E. Active approved owner anon metadata/sign => PASS; anon listing => DENY.
-- F. Same-business second active staff can manage object.
-- G. Metadata insert failure after upload => server action removes uploaded object.
-- H. Delete path verified; no service-role key appears in browser/client bundle.

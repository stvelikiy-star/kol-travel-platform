-- KÖL / 009 catalog media storage verification
-- READ-ONLY. Run after staging apply.

-- 1. Bucket contract.
select id,name,public,file_size_limit,allowed_mime_types
from storage.buckets
where id='catalog-media';

-- Expected:
-- public=false
-- file_size_limit=8388608
-- MIME list = jpeg/png/webp/avif

-- 2. Media metadata columns/indexes.
select column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema='public' and table_name='media_files'
order by ordinal_position;

select indexname,indexdef
from pg_indexes
where schemaname='public' and tablename='media_files'
order by indexname;

-- 3. Private helper hardening.
select n.nspname as schema_name,p.proname,p.prosecdef as security_definer,p.proconfig
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='private'
  and p.proname like 'catalog_media_%'
order by p.proname;

-- Expected: security_definer=true, search_path="" for each helper.

-- 4. media_files policies.
select policyname,roles,cmd,qual,with_check
from pg_policies
where schemaname='public' and tablename='media_files'
order by policyname;

-- 5. Storage object policies.
select policyname,roles,cmd,qual,with_check
from pg_policies
where schemaname='storage' and tablename='objects'
  and policyname like 'catalog media%'
order by policyname;

-- 6. No unexpected public bucket.
select count(*) as public_catalog_media_buckets
from storage.buckets
where id='catalog-media' and public=true;
-- Expected: 0.

-- 7. No existing object/metadata drift before staged test fixtures.
select
  (select count(*) from storage.objects where bucket_id='catalog-media') as objects,
  (select count(*) from public.media_files where storage_bucket='catalog-media') as metadata_rows;

-- Required role scenarios:
-- A. Partner A uploads valid JPEG to <A>/product/<A-product>/<uuid>.jpg => PASS.
-- B. Partner A tries <B>/product/<B-product>/<uuid>.jpg => DENY.
-- C. Partner A forges path owner UUID not belonging to business A => DENY.
-- D. Non-image/SVG or >8MiB => DENY by bucket/policy.
-- E. Inactive catalog item: anon metadata/sign => DENY.
-- F. Active item + approved partner: anon metadata/sign => PASS.
-- G. Anon list bucket => DENY.
-- H. Same-business second active staff member can manage the same object.
-- I. Metadata insert failure after upload => server action removes uploaded object.
-- J. Delete path: storage object removal + metadata cleanup verified; no service-role browser key.

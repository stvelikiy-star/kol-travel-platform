-- KÖL / 009a media_files.uploaded_by FK index verification
-- READ-ONLY. Run after 009a staged apply.

with uploaded_by as (
  select a.attnum
  from pg_catalog.pg_attribute a
  where a.attrelid = 'public.media_files'::regclass
    and a.attname = 'uploaded_by'
    and not a.attisdropped
), uploaded_by_fk as (
  select c.conname, c.conkey[1] as attnum
  from pg_catalog.pg_constraint c
  join uploaded_by u on c.conkey[1] = u.attnum
  where c.conrelid = 'public.media_files'::regclass
    and c.contype = 'f'
    and pg_catalog.cardinality(c.conkey) = 1
)
select
  f.conname,
  exists (
    select 1
    from pg_catalog.pg_index i
    where i.indrelid = 'public.media_files'::regclass
      and i.indisvalid
      and i.indisready
      and i.indkey[0] = f.attnum
  ) as has_leading_index
from uploaded_by_fk f;

-- Expected: exactly one FK row with has_leading_index=true.

select indexname, indexdef
from pg_catalog.pg_indexes
where schemaname = 'public'
  and tablename = 'media_files'
  and indexname = 'idx_media_files_uploaded_by';

-- Expected: exactly one valid btree index on uploaded_by.

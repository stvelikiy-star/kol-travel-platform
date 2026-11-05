-- Read-only verification after 027. Failure aborts staging apply.
do $$
declare
  v_type text;
  v_not_null boolean;
  v_default text;
begin
  select format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid)
  into v_type,v_not_null,v_default
  from pg_attribute a
  join pg_class c on c.oid=a.attrelid
  join pg_namespace n on n.oid=c.relnamespace
  left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
  where n.nspname='public' and c.relname='support_tickets'
    and a.attname='request_payload' and not a.attisdropped;
  if v_type is distinct from 'jsonb' or v_not_null is distinct from true
     or v_default is null then
    raise exception 'public_intake_payload_schema_missing_or_nullable';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname='public' and tablename='support_tickets'
      and indexname='idx_support_tickets_intake_phone_recent'
  ) then
    raise exception 'public_intake_rate_query_index_missing';
  end if;

  if has_table_privilege('anon','public.support_tickets','INSERT')
     or has_table_privilege('authenticated','public.support_tickets','INSERT') then
    raise exception 'public_intake_direct_support_write_exposure';
  end if;
end
$$;
select 'KOL_PUBLIC_INTAKE_SCHEMA_PASS' as result;

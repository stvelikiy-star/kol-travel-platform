-- KÖL / kol-travel-platform
-- AUTHENTICATED READ ACL — DRAFT / NOT APPLIED
-- Prepared: 2026-08-31
--
-- Purpose:
--   Reconcile PostgreSQL table ACLs with the already-reviewed RLS read contract.
--   The recovered/local baseline can have zero table privileges for the
--   `authenticated` API role even though RLS SELECT policies exist. In that state
--   normal authenticated REST reads fail at table ACL before RLS can evaluate.
--
-- Safety model:
--   - SELECT only; no INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER grants;
--   - only current public BASE TABLES with RLS enabled are granted;
--   - fail closed before any grant if a current public base table lacks RLS;
--   - RLS remains the row-level authorization boundary for every authenticated read;
--   - no live apply is authorized by this draft.

begin;

DO $$
DECLARE
  v_unprotected integer;
  r record;
BEGIN
  select count(*) into v_unprotected
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;

  if v_unprotected <> 0 then
    raise exception '006f refuses authenticated SELECT grant: % public base tables do not have RLS enabled', v_unprotected;
  end if;

  for r in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity
    order by c.relname
  loop
    execute format('grant select on table %I.%I to authenticated', r.schema_name, r.table_name);
  end loop;
END
$$;

commit;

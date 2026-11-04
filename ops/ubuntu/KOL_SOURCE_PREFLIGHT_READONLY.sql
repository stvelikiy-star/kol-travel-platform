-- KÖL source compatibility preflight — READ ONLY.
-- Tested on connected project mphruawzozrpwcjgejhs on 2026-10-27.
-- This reports factual source state, not permission for production apply.
-- The staging migration manifest explicitly forbids production apply.
--
-- Purpose: replace the obsolete 6-functions/99-indexes heuristic with an
-- explicitly identified current source shape (10 functions / 151 indexes).
-- Treat ANY unexpected difference as a review stop; do not auto-fix it.
-- Copy source counts and migration ledger into the release evidence before
-- cutover; checks must be rerun after freezing writes and immediately before
-- backup/restore. A zero-payment result is not a substitute for provider
-- reconciliation. Storage object bytes are not part of the SQL backup.
with checks as (
  select
    (select count(*)::int from information_schema.tables
       where table_schema='public' and table_type='BASE TABLE') as tables_count,
    (select count(*)::int from pg_class c
       join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relkind='r' and c.relrowsecurity) as rls_count,
    (select count(*)::int from pg_proc p
       join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public') as functions_count,
    (select count(*)::int from pg_indexes
       where schemaname='public') as indexes_count,
    (select count(*)::int from supabase_migrations.schema_migrations) as migration_count,
    (select count(*)::int from auth.users) as auth_users,
    (select count(*)::int from public.bookings) as bookings,
    (select count(*)::int from public.orders) as orders,
    (select count(*)::int from public.support_tickets) as support_tickets,
    (select count(*)::int from public.payments) as payments,
    (select count(*)::int from storage.objects) as storage_objects,
    (select count(*)::int from information_schema.columns
       where table_schema='public' and
         (table_name,column_name) in (
           ('menu_items','slug'),('products','slug'),
           ('tours','image_url'),('stays','capacity')
         )) as excluded_columns
)
select *,
  (tables_count=54 and rls_count=54 and excluded_columns=0 and payments=0)
    as no_known_shape_or_payment_blocker,
  (functions_count=6 and indexes_count=99)
    as historical_20260912_shape_matches,
  (functions_count=10 and indexes_count=151)
    as known_20261027_source_shape_matches
from checks;

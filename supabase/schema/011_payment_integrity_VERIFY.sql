-- KÖL payment integrity verification — READ ONLY
-- Run only after staging application of 011_payment_integrity_DRAFT_NOT_APPLIED.sql.

-- 1. Provider reference must be unique per provider.
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'payments'
  and indexname = 'uq_payments_provider_reference';

-- 2. Normal API roles must not have payment mutation grants.
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'payments'
  and grantee in ('anon','authenticated')
  and privilege_type in ('INSERT','UPDATE','DELETE')
order by grantee, privilege_type;
-- Expected: 0 rows.

-- 3. Legacy direct finance mutation policy must be absent.
select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'payments'
  and policyname = 'finance admins manage payments';
-- Expected: 0 rows.

-- 4. Provider event ledger exists outside exposed public schema.
select table_schema, table_name
from information_schema.tables
where table_schema = 'private'
  and table_name = 'payment_provider_events';

-- 5. Provider event idempotency constraint exists.
select c.conname, pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class r on r.oid = c.conrelid
join pg_namespace n on n.oid = r.relnamespace
where n.nspname = 'private'
  and r.relname = 'payment_provider_events'
  and c.conname = 'payment_provider_events_provider_event_unique';

-- 6. Payment RPC permissions: service_role only.
select p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('create_payment_attempt_atomic','apply_verified_payment_event_atomic')
order by p.proname;
-- Expected: anon=false, authenticated=false, service_role=true.

-- 7. No live provider payload should be retained by this ledger schema.
select column_name
from information_schema.columns
where table_schema = 'private'
  and table_name = 'payment_provider_events'
  and column_name in ('raw_payload','payload','body');
-- Expected: 0 rows.

-- 8. Functional staging tests still required and cannot be replaced by catalog checks:
-- - create one pending order/booking and a provider attempt;
-- - replay same provider_reference => same compatible payment id;
-- - apply same event_id twice => second call duplicate/no second mutation;
-- - wrong paid amount => payment + parent unchanged, mismatch audit written;
-- - valid paid amount => payment and parent paid in the same transaction;
-- - failed/cancelled attempt => parent remains pending;
-- - refund event => ignored, no refund mutation;
-- - concurrent double settlement => both financial rows reflect provider truth and duplicate settlement is audited.

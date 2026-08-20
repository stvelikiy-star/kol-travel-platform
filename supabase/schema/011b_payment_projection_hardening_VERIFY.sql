-- KÖL / 011b payment hardening verification
-- READ-ONLY. Run after staged 011 + 011a + 011b apply.

-- 1. Public service-role wrapper + private preserved attempt implementation exist.
select
  pg_catalog.to_regprocedure('public.create_payment_attempt_atomic(text,uuid,text,text,text)') as public_attempt,
  pg_catalog.to_regprocedure('private.create_payment_attempt_atomic_v1_internal(text,uuid,text,text,text)') as private_attempt;

-- 2. Public wrapper is service-role only. The preserved implementation is outside
-- the exposed public schema and executable only by the trusted service role.
select n.nspname as schema_name, p.proname,
  pg_catalog.has_function_privilege('public', p.oid, 'EXECUTE') as public_execute,
  pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute,
  p.prosecdef as security_definer,
  p.proconfig
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where (n.nspname='public' and p.proname='create_payment_attempt_atomic')
   or (n.nspname='private' and p.proname='create_payment_attempt_atomic_v1_internal')
order by n.nspname, p.proname;

-- Expected: public/anon/authenticated execute=false for both; service_role=true.
-- Both remain SECURITY INVOKER with fixed search_path.

-- 3. Financial row-shape constraints are present and validated.
select c.conname, c.convalidated, pg_catalog.pg_get_constraintdef(c.oid) as definition
from pg_catalog.pg_constraint c
where c.conrelid in ('public.payments'::regclass,'private.payment_provider_events'::regclass)
  and c.conname in (
    'payments_provider_pair_check',
    'payments_provider_subject_shape_check',
    'payments_provider_status_check',
    'payment_provider_events_payload_hash_sha256_check'
  )
order by c.conname;

-- 4. Integrity/projection triggers exist.
select n.nspname as schema_name, c.relname as table_name, t.tgname,
  pg_catalog.pg_get_triggerdef(t.oid) as definition
from pg_catalog.pg_trigger t
join pg_catalog.pg_class c on c.oid=t.tgrelid
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where not t.tgisinternal
  and t.tgname in (
    'trg_guard_provider_payment_identity',
    'trg_normalize_order_payment_projection',
    'trg_sync_order_payment_projection_after_payment',
    'trg_payment_provider_event_replay_guard'
  )
order by t.tgname;

-- 5. Normal API roles cannot mutate payment truth or projection.
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema='public'
  and table_name in ('payments','order_payments')
  and grantee in ('anon','authenticated')
  and privilege_type in ('INSERT','UPDATE','DELETE')
order by table_name, grantee, privilege_type;
-- Expected: zero rows.

-- 6. Existing order projection rows, if any, match authoritative payment values.
select op.id, op.order_id, op.payment_id,
  op.amount as projection_amount, p.amount as payment_amount,
  op.status as projection_status, p.status as payment_status
from public.order_payments op
join public.payments p on p.id=op.payment_id
where p.order_id is distinct from op.order_id
   or p.amount is distinct from op.amount
   or p.status is distinct from op.status;
-- Expected: zero rows.

-- Required staged concurrency/functional tests:
-- A. concurrent identical provider-reference attempt => same payment id, one row.
-- B. same provider-reference + changed method/subject => conflict.
-- C. attempt amount/user/subject are DB-derived and immutable afterward.
-- D. order_payments link receives exact payment amount/status automatically.
-- E. verified paid/failed/cancelled event keeps order_payments projection synchronized.
-- F. event replay conflict guard rejects same event id with altered identity/hash.
-- G. wrong paid amount changes neither payment nor parent/projection status.
-- H. refund event remains recorded/ignored; no auto-refund mutation.

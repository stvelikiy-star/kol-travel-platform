-- KÖL / kol-travel-platform
-- PAYMENT ATTEMPT + ORDER PAYMENT PROJECTION HARDENING — DRAFT NOT APPLIED
-- Prepared: 2026-08-20
-- Depends on 011_payment_integrity_DRAFT_NOT_APPLIED.sql and 011a replay guard.
--
-- Goals:
-- - serialize concurrent retries of the same provider reference;
-- - reject same provider reference reused with a different method/subject;
-- - move the preserved 011 attempt implementation out of the exposed public schema;
-- - make provider-payment financial identity immutable after creation;
-- - keep public.order_payments amount/status synchronized from public.payments;
-- - block direct browser/session mutation of order_payments;
-- - require one payment subject for provider-backed payment rows;
-- - require SHA-256-shaped provider event hashes.
--
-- This layer remains provider-neutral. It does not initiate a charge/refund and
-- does not choose fees, commissions, currencies, cancellation or refund policy.

begin;

-- ---------------------------------------------------------------------------
-- 1. Provider-backed row shape constraints
-- ---------------------------------------------------------------------------

do $constraints$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.payments'::regclass
      and conname = 'payments_provider_pair_check'
  ) then
    alter table public.payments
      add constraint payments_provider_pair_check
      check (
        (provider is null and provider_reference is null)
        or (provider is not null and provider_reference is not null)
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.payments'::regclass
      and conname = 'payments_provider_subject_shape_check'
  ) then
    alter table public.payments
      add constraint payments_provider_subject_shape_check
      check (
        provider_reference is null
        or ((order_id is null) <> (booking_id is null))
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.payments'::regclass
      and conname = 'payments_provider_status_check'
  ) then
    alter table public.payments
      add constraint payments_provider_status_check
      check (
        provider_reference is null
        or status in ('pending','paid','failed','cancelled','refunded')
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'private.payment_provider_events'::regclass
      and conname = 'payment_provider_events_payload_hash_sha256_check'
  ) then
    alter table private.payment_provider_events
      add constraint payment_provider_events_payload_hash_sha256_check
      check (payload_hash ~ '^[0-9a-f]{64}$') not valid;
  end if;
end
$constraints$;

alter table public.payments validate constraint payments_provider_pair_check;
alter table public.payments validate constraint payments_provider_subject_shape_check;
alter table public.payments validate constraint payments_provider_status_check;
alter table private.payment_provider_events validate constraint payment_provider_events_payload_hash_sha256_check;

-- ---------------------------------------------------------------------------
-- 2. Preserve audited 011 attempt implementation in the non-exposed private
--    schema and add a serialized service-role public entrypoint.
-- ---------------------------------------------------------------------------

do $move_attempt$
begin
  if pg_catalog.to_regprocedure('private.create_payment_attempt_atomic_v1_internal(text,uuid,text,text,text)') is null then
    if pg_catalog.to_regprocedure('public.create_payment_attempt_atomic(text,uuid,text,text,text)') is null then
      raise exception '011 create_payment_attempt_atomic is required before 011b' using errcode = '55000';
    end if;

    alter function public.create_payment_attempt_atomic(text,uuid,text,text,text)
      set schema private;
    alter function private.create_payment_attempt_atomic(text,uuid,text,text,text)
      rename to create_payment_attempt_atomic_v1_internal;
  end if;
end
$move_attempt$;

revoke all on function private.create_payment_attempt_atomic_v1_internal(text,uuid,text,text,text) from public;
revoke all on function private.create_payment_attempt_atomic_v1_internal(text,uuid,text,text,text) from anon, authenticated;
grant execute on function private.create_payment_attempt_atomic_v1_internal(text,uuid,text,text,text) to service_role;

create or replace function public.create_payment_attempt_atomic(
  p_subject_type text,
  p_subject_id uuid,
  p_provider text,
  p_provider_reference text,
  p_method text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_payment_id uuid;
  v_payment public.payments%rowtype;
  v_provider text := pg_catalog.btrim(p_provider);
  v_reference text := pg_catalog.btrim(p_provider_reference);
  v_method text := pg_catalog.btrim(p_method);
begin
  if current_user <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  if v_provider is null or length(v_provider) < 2 or length(v_provider) > 64 then
    raise exception 'invalid_payment_provider' using errcode = '22023';
  end if;

  if v_reference is null or length(v_reference) < 4 or length(v_reference) > 255 then
    raise exception 'invalid_provider_reference' using errcode = '22023';
  end if;

  if v_method is null or length(v_method) < 2 or length(v_method) > 64 then
    raise exception 'invalid_payment_method' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_provider || E'\x1f' || v_reference, 0)
  );

  v_payment_id := private.create_payment_attempt_atomic_v1_internal(
    p_subject_type,
    p_subject_id,
    v_provider,
    v_reference,
    v_method
  );

  select p.* into v_payment
  from public.payments as p
  where p.id = v_payment_id;

  if v_payment.id is null then
    raise exception 'payment_attempt_result_missing' using errcode = 'P0001';
  end if;

  if v_payment.provider is distinct from v_provider
     or v_payment.provider_reference is distinct from v_reference
     or v_payment.method is distinct from v_method
     or (p_subject_type = 'order' and (
       v_payment.order_id is distinct from p_subject_id or v_payment.booking_id is not null
     ))
     or (p_subject_type = 'booking' and (
       v_payment.booking_id is distinct from p_subject_id or v_payment.order_id is not null
     )) then
    raise exception 'provider_reference_payload_conflict' using errcode = '23505';
  end if;

  return v_payment_id;
end;
$$;

revoke all on function public.create_payment_attempt_atomic(text,uuid,text,text,text) from public;
revoke all on function public.create_payment_attempt_atomic(text,uuid,text,text,text) from anon, authenticated;
grant execute on function public.create_payment_attempt_atomic(text,uuid,text,text,text) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Provider payment identity is immutable after creation.
-- ---------------------------------------------------------------------------

create or replace function private.guard_provider_payment_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.provider_reference is not null and (
    new.user_id is distinct from old.user_id
    or new.order_id is distinct from old.order_id
    or new.booking_id is distinct from old.booking_id
    or new.amount is distinct from old.amount
    or new.provider is distinct from old.provider
    or new.provider_reference is distinct from old.provider_reference
    or new.method is distinct from old.method
  ) then
    raise exception 'provider_payment_identity_immutable' using errcode = '23000';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_provider_payment_identity() from public;
revoke all on function private.guard_provider_payment_identity() from anon, authenticated;

drop trigger if exists trg_guard_provider_payment_identity on public.payments;
create trigger trg_guard_provider_payment_identity
before update of user_id, order_id, booking_id, amount, provider, provider_reference, method
on public.payments
for each row
execute function private.guard_provider_payment_identity();

-- ---------------------------------------------------------------------------
-- 4. order_payments is a projection of payment truth, not a second source.
-- ---------------------------------------------------------------------------

revoke insert, update, delete on table public.order_payments from anon, authenticated;

create or replace function private.normalize_order_payment_projection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_amount numeric;
  v_status text;
begin
  select p.order_id, p.amount, p.status
    into v_order_id, v_amount, v_status
  from public.payments as p
  where p.id = new.payment_id;

  if not found or v_order_id is null or v_order_id is distinct from new.order_id then
    raise exception 'order_payment_projection_subject_mismatch' using errcode = '23503';
  end if;

  new.amount := v_amount;
  new.status := v_status;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function private.normalize_order_payment_projection() from public;
revoke all on function private.normalize_order_payment_projection() from anon, authenticated;

drop trigger if exists trg_normalize_order_payment_projection on public.order_payments;
create trigger trg_normalize_order_payment_projection
before insert or update of order_id, payment_id, amount, status
on public.order_payments
for each row
execute function private.normalize_order_payment_projection();

create or replace function private.sync_order_payment_projection_after_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.order_id is not null then
    update public.order_payments
    set amount = new.amount,
        status = new.status,
        updated_at = pg_catalog.now()
    where payment_id = new.id
      and order_id = new.order_id;
  end if;

  return new;
end;
$$;

revoke all on function private.sync_order_payment_projection_after_payment() from public;
revoke all on function private.sync_order_payment_projection_after_payment() from anon, authenticated;

drop trigger if exists trg_sync_order_payment_projection_after_payment on public.payments;
create trigger trg_sync_order_payment_projection_after_payment
after update of amount, status
on public.payments
for each row
execute function private.sync_order_payment_projection_after_payment();

-- Reconcile any staged/recovery rows. Current verified live KÖL has zero rows in
-- both public.payments and public.order_payments.
update public.order_payments as op
set amount = p.amount,
    status = p.status,
    updated_at = pg_catalog.now()
from public.payments as p
where p.id = op.payment_id
  and p.order_id = op.order_id
  and (op.amount is distinct from p.amount or op.status is distinct from p.status);

commit;

-- REQUIRED STAGING PROOF
-- 1. Concurrent same provider/reference/payload => same payment id, one row.
-- 2. Same provider/reference with different method/subject => payload conflict.
-- 3. Provider payment user/subject/amount/provider/reference/method cannot be rebound.
-- 4. order_payments snapshots authoritative payment amount/status, never caller/default values.
-- 5. Valid paid/failed/cancelled event keeps order_payments.status synchronized.
-- 6. authenticated/anon cannot INSERT/UPDATE/DELETE payments or order_payments.
-- 7. Provider event payload_hash must be exactly 64 lowercase hex characters.
-- 8. Refund remains fail-closed; no automatic refund or inventory release is introduced.

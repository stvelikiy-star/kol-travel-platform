-- KÖL / kol-travel-platform
-- PAYMENT INTEGRITY CORE — DRAFT NOT APPLIED
-- Prepared: 2026-08-20
--
-- Provider-neutral integrity layer only. This file does NOT choose a payment
-- provider, initiate a real charge, enable refunds, or apply any live change.
--
-- Verified live facts behind this draft:
-- - public.payments currently has 0 rows;
-- - provider/provider_reference exist but are not unique;
-- - authenticated currently has INSERT/UPDATE/DELETE grants on payments;
-- - a finance-admin UPDATE policy can directly mutate payment rows;
-- - there is no provider webhook-event idempotency ledger;
-- - order/booking payment truth is stored on the parent row as payment_status.
--
-- Required before apply:
-- 1. logical backup + accepted migration baseline;
-- 2. PR #13 security baseline staged first;
-- 3. provider adapter with real signature verification;
-- 4. staging replay/idempotency/concurrency tests;
-- 5. owner decision for refunds/cancellations/provider/fees.

begin;

-- ---------------------------------------------------------------------------
-- 1. Private provider-event ledger.
-- Raw provider payloads are intentionally NOT stored here. The webhook adapter
-- should retain only a SHA-256 payload hash and sanitized non-sensitive metadata.
-- ---------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;
grant usage on schema private to service_role;

create table if not exists private.payment_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  provider_reference text not null,
  event_type text not null,
  requested_status text not null,
  amount numeric,
  payload_hash text not null,
  processing_status text not null default 'received',
  payment_id uuid references public.payments(id) on delete set null,
  processing_note text,
  metadata jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint payment_provider_events_processing_status_check
    check (processing_status in ('received','applied','ignored','rejected')),
  constraint payment_provider_events_requested_status_check
    check (requested_status in ('paid','failed','cancelled','refunded')),
  constraint payment_provider_events_provider_event_unique
    unique (provider, event_id)
);

revoke all on table private.payment_provider_events from public;
revoke all on table private.payment_provider_events from anon, authenticated;
grant select, insert, update on table private.payment_provider_events to service_role;

create index if not exists idx_payment_provider_events_reference
  on private.payment_provider_events(provider, provider_reference);

create index if not exists idx_payment_provider_events_payment_id
  on private.payment_provider_events(payment_id);

-- One provider-side payment reference must identify at most one internal payment.
create unique index if not exists uq_payments_provider_reference
  on public.payments(provider, provider_reference)
  where provider is not null and provider_reference is not null;

-- ---------------------------------------------------------------------------
-- 2. Close direct payment mutation from browser/session roles.
-- Customers and finance users may still receive scoped SELECT through RLS, but
-- normal authenticated requests cannot create/change/delete financial truth.
-- ---------------------------------------------------------------------------

revoke insert, update, delete on table public.payments from anon, authenticated;
drop policy if exists "finance admins manage payments" on public.payments;

-- ---------------------------------------------------------------------------
-- 3. Create a provider payment attempt from authoritative parent totals.
-- This RPC is service-role only. Amount/user_id are never accepted as input.
-- ---------------------------------------------------------------------------

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
  v_user_id uuid;
  v_total numeric;
  v_parent_payment_status text;
  v_existing public.payments%rowtype;
  v_payment_id uuid;
begin
  if current_user <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  if p_subject_type not in ('order','booking') then
    raise exception 'invalid_payment_subject_type' using errcode = '22023';
  end if;

  if p_subject_id is null then
    raise exception 'payment_subject_required' using errcode = '22023';
  end if;

  if p_provider is null or length(btrim(p_provider)) < 2 or length(p_provider) > 64 then
    raise exception 'invalid_payment_provider' using errcode = '22023';
  end if;

  if p_provider_reference is null
     or length(btrim(p_provider_reference)) < 4
     or length(p_provider_reference) > 255 then
    raise exception 'invalid_provider_reference' using errcode = '22023';
  end if;

  if p_method is null or length(btrim(p_method)) < 2 or length(p_method) > 64 then
    raise exception 'invalid_payment_method' using errcode = '22023';
  end if;

  if p_subject_type = 'order' then
    select o.client_id, o.total, o.payment_status
      into v_user_id, v_total, v_parent_payment_status
    from public.orders as o
    where o.id = p_subject_id
    for update;
  else
    select b.client_id, b.total, b.payment_status
      into v_user_id, v_total, v_parent_payment_status
    from public.bookings as b
    where b.id = p_subject_id
    for update;
  end if;

  if v_user_id is null then
    raise exception 'payment_subject_not_found' using errcode = 'P0001';
  end if;

  if v_total is null or v_total <= 0 then
    raise exception 'invalid_authoritative_total' using errcode = 'P0001';
  end if;

  if v_parent_payment_status in ('paid','refunded') then
    raise exception 'payment_subject_already_settled' using errcode = 'P0001';
  end if;

  select p.* into v_existing
  from public.payments as p
  where p.provider = p_provider
    and p.provider_reference = p_provider_reference
  limit 1;

  if v_existing.id is not null then
    if v_existing.user_id is distinct from v_user_id
       or v_existing.amount is distinct from v_total
       or (p_subject_type = 'order' and v_existing.order_id is distinct from p_subject_id)
       or (p_subject_type = 'booking' and v_existing.booking_id is distinct from p_subject_id) then
      raise exception 'provider_reference_conflict' using errcode = '23505';
    end if;

    return v_existing.id;
  end if;

  insert into public.payments (
    user_id,
    order_id,
    booking_id,
    method,
    status,
    amount,
    provider,
    provider_reference,
    metadata
  ) values (
    v_user_id,
    case when p_subject_type = 'order' then p_subject_id else null end,
    case when p_subject_type = 'booking' then p_subject_id else null end,
    btrim(p_method),
    'pending',
    v_total,
    btrim(p_provider),
    btrim(p_provider_reference),
    jsonb_build_object('source','provider_attempt_rpc','subject_type',p_subject_type)
  )
  returning id into v_payment_id;

  if p_subject_type = 'order' then
    insert into public.order_payments(order_id, payment_id)
    values (p_subject_id, v_payment_id)
    on conflict (order_id, payment_id) do nothing;
  end if;

  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before,
    after,
    reason,
    request_id
  ) values (
    null,
    'payment_system',
    'payment_attempt_created',
    'payments',
    v_payment_id,
    null,
    jsonb_build_object(
      'status','pending',
      'amount',v_total,
      'provider',btrim(p_provider),
      'subject_type',p_subject_type,
      'subject_id',p_subject_id
    ),
    'Authoritative provider payment attempt created.',
    'payment-attempt-' || v_payment_id::text
  );

  return v_payment_id;
end;
$$;

revoke all on function public.create_payment_attempt_atomic(text,uuid,text,text,text) from public;
revoke all on function public.create_payment_attempt_atomic(text,uuid,text,text,text) from anon, authenticated;
grant execute on function public.create_payment_attempt_atomic(text,uuid,text,text,text) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Apply an already signature-verified provider event atomically.
-- Signature verification MUST happen before this RPC in a provider-specific
-- server/Edge adapter. This function deliberately does not know provider secrets.
--
-- Refund events are recorded but NOT applied until the owner-approved refund
-- workflow exists. No automatic refund or inventory release happens here.
-- ---------------------------------------------------------------------------

create or replace function public.apply_verified_payment_event_atomic(
  p_provider text,
  p_event_id text,
  p_event_type text,
  p_provider_reference text,
  p_verified_status text,
  p_amount numeric,
  p_payload_hash text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event_row_id uuid;
  v_existing_event private.payment_provider_events%rowtype;
  v_payment public.payments%rowtype;
  v_before_status text;
  v_parent_status text;
  v_duplicate_settlement boolean := false;
  v_action text;
begin
  if current_user <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  if p_provider is null or length(btrim(p_provider)) < 2 or length(p_provider) > 64 then
    raise exception 'invalid_payment_provider' using errcode = '22023';
  end if;

  if p_event_id is null or length(btrim(p_event_id)) < 3 or length(p_event_id) > 255 then
    raise exception 'invalid_provider_event_id' using errcode = '22023';
  end if;

  if p_provider_reference is null
     or length(btrim(p_provider_reference)) < 4
     or length(p_provider_reference) > 255 then
    raise exception 'invalid_provider_reference' using errcode = '22023';
  end if;

  if p_verified_status not in ('paid','failed','cancelled','refunded') then
    raise exception 'invalid_verified_payment_status' using errcode = '22023';
  end if;

  if p_payload_hash is null or length(btrim(p_payload_hash)) < 32 or length(p_payload_hash) > 128 then
    raise exception 'invalid_payload_hash' using errcode = '22023';
  end if;

  insert into private.payment_provider_events (
    provider,
    event_id,
    provider_reference,
    event_type,
    requested_status,
    amount,
    payload_hash,
    metadata
  ) values (
    btrim(p_provider),
    btrim(p_event_id),
    btrim(p_provider_reference),
    coalesce(nullif(btrim(p_event_type),''),'unknown'),
    p_verified_status,
    p_amount,
    btrim(p_payload_hash),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (provider, event_id) do nothing
  returning id into v_event_row_id;

  if v_event_row_id is null then
    select e.* into v_existing_event
    from private.payment_provider_events as e
    where e.provider = btrim(p_provider)
      and e.event_id = btrim(p_event_id)
    limit 1;

    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'applied', v_existing_event.processing_status = 'applied',
      'processing_status', v_existing_event.processing_status,
      'payment_id', v_existing_event.payment_id
    );
  end if;

  select p.* into v_payment
  from public.payments as p
  where p.provider = btrim(p_provider)
    and p.provider_reference = btrim(p_provider_reference)
  for update;

  if v_payment.id is null then
    update private.payment_provider_events
    set processing_status = 'rejected',
        processing_note = 'payment_not_found',
        processed_at = now()
    where id = v_event_row_id;

    return jsonb_build_object('ok', false, 'applied', false, 'code', 'payment_not_found');
  end if;

  update private.payment_provider_events
  set payment_id = v_payment.id
  where id = v_event_row_id;

  if (v_payment.order_id is null and v_payment.booking_id is null)
     or (v_payment.order_id is not null and v_payment.booking_id is not null) then
    update private.payment_provider_events
    set processing_status = 'rejected',
        processing_note = 'invalid_payment_subject_shape',
        processed_at = now()
    where id = v_event_row_id;

    return jsonb_build_object('ok', false, 'applied', false, 'code', 'invalid_payment_subject_shape');
  end if;

  if p_verified_status = 'paid'
     and (p_amount is null or p_amount is distinct from v_payment.amount) then
    update private.payment_provider_events
    set processing_status = 'rejected',
        processing_note = 'provider_amount_mismatch',
        processed_at = now()
    where id = v_event_row_id;

    insert into public.audit_logs (
      actor_id, actor_role, action, entity_type, entity_id, before, after, reason, request_id
    ) values (
      null,
      'payment_system',
      'payment_amount_mismatch',
      'payments',
      v_payment.id,
      jsonb_build_object('expected_amount',v_payment.amount),
      jsonb_build_object('provider_amount',p_amount,'provider',p_provider,'event_id',p_event_id),
      'Verified provider event amount did not match the authoritative payment amount.',
      'payment-event-' || v_event_row_id::text
    );

    return jsonb_build_object('ok', false, 'applied', false, 'code', 'provider_amount_mismatch');
  end if;

  -- Refund truth is intentionally held for a separate approved workflow.
  if p_verified_status = 'refunded' then
    update private.payment_provider_events
    set processing_status = 'ignored',
        processing_note = 'refund_workflow_not_enabled',
        processed_at = now()
    where id = v_event_row_id;

    insert into public.audit_logs (
      actor_id, actor_role, action, entity_type, entity_id, before, after, reason, request_id
    ) values (
      null,
      'payment_system',
      'provider_refund_event_requires_review',
      'payments',
      v_payment.id,
      jsonb_build_object('status',v_payment.status),
      jsonb_build_object('provider_status','refunded','event_id',p_event_id),
      'Provider refund event recorded but automatic refund application is disabled.',
      'payment-event-' || v_event_row_id::text
    );

    return jsonb_build_object(
      'ok', true,
      'applied', false,
      'processing_status', 'ignored',
      'code', 'refund_workflow_not_enabled',
      'payment_id', v_payment.id
    );
  end if;

  v_before_status := v_payment.status;

  if p_verified_status = 'paid' then
    if v_payment.order_id is not null then
      select o.payment_status into v_parent_status
      from public.orders as o
      where o.id = v_payment.order_id
      for update;
    else
      select b.payment_status into v_parent_status
      from public.bookings as b
      where b.id = v_payment.booking_id
      for update;
    end if;

    v_duplicate_settlement := (v_parent_status = 'paid' and v_before_status <> 'paid');

    if v_before_status <> 'paid' then
      update public.payments
      set status = 'paid', updated_at = now()
      where id = v_payment.id;
    end if;

    if v_payment.order_id is not null then
      update public.orders
      set payment_status = 'paid', updated_at = now()
      where id = v_payment.order_id
        and payment_status <> 'paid';
    else
      update public.bookings
      set payment_status = 'paid', updated_at = now()
      where id = v_payment.booking_id
        and payment_status <> 'paid';
    end if;

    v_action := case
      when v_duplicate_settlement then 'duplicate_payment_settlement_detected'
      else 'payment_marked_paid_from_verified_provider_event'
    end;
  elsif p_verified_status in ('failed','cancelled') then
    -- A failed/cancelled attempt does not mark the parent transaction failed;
    -- another payment attempt may still succeed. Never downgrade paid truth.
    if v_before_status = 'pending' then
      update public.payments
      set status = p_verified_status, updated_at = now()
      where id = v_payment.id;
    end if;

    v_action := 'payment_attempt_' || p_verified_status;
  end if;

  update private.payment_provider_events
  set processing_status = 'applied',
      processing_note = case when v_duplicate_settlement then 'duplicate_settlement_requires_review' else null end,
      processed_at = now()
  where id = v_event_row_id;

  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before,
    after,
    reason,
    request_id
  ) values (
    null,
    'payment_system',
    v_action,
    'payments',
    v_payment.id,
    jsonb_build_object('status',v_before_status),
    jsonb_build_object(
      'status',case when p_verified_status = 'paid' then 'paid' else case when v_before_status = 'pending' then p_verified_status else v_before_status end end,
      'provider',p_provider,
      'event_id',p_event_id,
      'duplicate_settlement',v_duplicate_settlement
    ),
    'Verified provider payment event applied atomically.',
    'payment-event-' || v_event_row_id::text
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'applied', true,
    'payment_id', v_payment.id,
    'duplicate_settlement', v_duplicate_settlement
  );
end;
$$;

revoke all on function public.apply_verified_payment_event_atomic(text,text,text,text,text,numeric,text,jsonb) from public;
revoke all on function public.apply_verified_payment_event_atomic(text,text,text,text,text,numeric,text,jsonb) from anon, authenticated;
grant execute on function public.apply_verified_payment_event_atomic(text,text,text,text,text,numeric,text,jsonb) to service_role;

commit;

-- ---------------------------------------------------------------------------
-- STAGING VERIFICATION REQUIREMENTS
-- ---------------------------------------------------------------------------
-- 1. authenticated/anon cannot INSERT/UPDATE/DELETE public.payments.
-- 2. authenticated/anon cannot EXECUTE either payment RPC.
-- 3. service_role create_payment_attempt derives amount/user_id from order/booking.
-- 4. same (provider,provider_reference) returns same compatible payment id.
-- 5. same (provider,event_id) replay does not apply twice.
-- 6. paid event with wrong amount changes neither payment nor parent status.
-- 7. paid event atomically marks payment + parent payment_status = paid + audit + event ledger.
-- 8. failed/cancelled changes only the attempt; parent remains pending.
-- 9. refund event is recorded/ignored and never auto-refunds.
-- 10. two pending attempts that both settle are both recorded; second settlement is audited as duplicate requiring review.

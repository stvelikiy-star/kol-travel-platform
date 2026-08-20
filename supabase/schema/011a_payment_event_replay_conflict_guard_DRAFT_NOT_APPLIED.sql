-- KÖL / kol-travel-platform
-- PAYMENT EVENT REPLAY CONFLICT GUARD — DRAFT NOT APPLIED
-- Prepared: 2026-08-20
-- Depends on: 011_payment_integrity_DRAFT_NOT_APPLIED.sql
--
-- Purpose:
-- A repeated (provider,event_id) is a safe idempotent replay only when the
-- security-relevant event identity is the same. Reusing the same event id with
-- a different payload hash/reference/status/amount/type must fail closed.
--
-- The advisory transaction lock serializes concurrent inserts for the same
-- provider+event id so a conflicting concurrent replay cannot hide behind
-- ON CONFLICT DO NOTHING in the main payment RPC.

begin;

create or replace function private.guard_payment_provider_event_replay()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing private.payment_provider_events%rowtype;
begin
  -- Two-int advisory key avoids exposing event text and is transaction-scoped.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(new.provider),
    pg_catalog.hashtext(new.event_id)
  );

  select e.* into v_existing
  from private.payment_provider_events as e
  where e.provider = new.provider
    and e.event_id = new.event_id
  limit 1;

  if v_existing.id is null then
    return new;
  end if;

  if v_existing.provider_reference is distinct from new.provider_reference
     or v_existing.event_type is distinct from new.event_type
     or v_existing.requested_status is distinct from new.requested_status
     or v_existing.amount is distinct from new.amount
     or v_existing.payload_hash is distinct from new.payload_hash then
    raise exception 'provider_event_replay_conflict' using errcode = '23505';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_payment_provider_event_replay() from public;
revoke all on function private.guard_payment_provider_event_replay() from anon, authenticated;

drop trigger if exists trg_payment_provider_event_replay_guard
on private.payment_provider_events;

create trigger trg_payment_provider_event_replay_guard
before insert on private.payment_provider_events
for each row
execute function private.guard_payment_provider_event_replay();

commit;

-- STAGING VERIFY:
-- 1. first event insert succeeds;
-- 2. exact same provider/event replay is handled idempotently by 011 RPC;
-- 3. same provider/event with a different payload_hash fails with
--    provider_event_replay_conflict;
-- 4. same provider/event with different reference/status/amount/type also fails;
-- 5. two concurrent conflicting inserts serialize and exactly one identity wins.

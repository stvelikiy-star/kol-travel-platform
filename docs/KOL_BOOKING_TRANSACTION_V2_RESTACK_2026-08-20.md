# KÖL — Booking Transaction V2 Restack

**Prepared:** 2026-08-20  
**Mode:** source-only; live Supabase remains unchanged

## Fresh live contract check

The live project still exposes the same authoritative primitives used by the historical 007 draft:

- `rooms`: business, capacity, `price_per_night`, status
- `room_availability`: unique `(room_id,date)`, status, `available_count`, optional price override
- `tours`: business, authoritative price, status
- `tour_schedules`: date/time, capacity, `booked_count`, status
- `bookings`: client/business/type/object/dates/guest count/server total/payment status/metadata
- `booking_status_history`: booking transition history

Live inventory rows are still not initialized for functional concurrency testing. This remains a staging prerequisite.

## Restacked source order

1. `007_booking_transaction_core_DRAFT_NOT_APPLIED.sql`
   - DB-authoritative Stay/Tour pricing
   - `FOR UPDATE` inventory locks
   - no-overbooking checks
   - booking + inventory + initial history in one transaction
   - caller identity from `auth.uid()`
   - client-scoped idempotency unique index
2. `007a_booking_direct_write_lockdown_DRAFT_NOT_APPLIED.sql`
   - direct booking INSERT remains fail-closed; creation goes through atomic RPCs
3. `007b_booking_idempotency_serialization_DRAFT_NOT_APPLIED.sql`
   - serializes `(user,idempotency_key)` with transaction advisory locks before inventory work
   - rejects same-key/different-payload reuse
   - hides the reviewed unlocked 007 implementations from normal API roles
   - exposes only strict public wrapper RPCs

## Why 007b was added

The original 007 prevents inventory oversell and protects duplicate committed rows with a unique index. However, two simultaneous requests using the same key but different inventory resources can reach separate row locks before the unique index arbitrates the final INSERT. The losing transaction rolls back safely, but it can receive a uniqueness error instead of deterministic replay. Also, a later retry with the same key and a different payload could otherwise replay the earlier booking based only on booking type.

007b moves idempotency serialization ahead of inventory locking and validates the original request payload before replaying an existing booking.

## Required staging proof

- identical concurrent Stay retries return/replay one booking and decrement room inventory once;
- identical concurrent Tour retries return/replay one booking and increment capacity once;
- same key + different Stay room/date/guests => explicit conflict and zero additional inventory mutation;
- same key + different Tour schedule/participants => explicit conflict;
- same key reused across Stay/Tour => explicit conflict;
- `*_unlocked` implementations are not executable by `anon` or `authenticated`;
- failed transactions leave inventory unchanged;
- booking and first history row commit atomically.

## Safety gate

Do not apply to live Supabase until a logical backup/schema baseline exists and these tests have passed on a dedicated staging database. No cancellation, refund, no-show, payment capture or inventory-release semantics are invented by this restack.

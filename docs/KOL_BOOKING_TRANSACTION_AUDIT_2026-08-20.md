# KÖL — Booking Transaction Core Audit

**Prepared:** 2026-08-20  
**Mode:** live schema read-only audit + source-only draft; no database mutation

## Live facts

The existing schema already has the minimum inventory primitives needed for a safe first booking core:

### Stay

`room_availability` contains:

- `room_id`
- `date`
- `status` (default `available`)
- `available_count` (default `1`)
- `price_override`
- `UNIQUE(room_id, date)`

`rooms` contains authoritative `business_id`, `capacity`, `price_per_night`, `status`.

### Tours

`tour_schedules` contains:

- `tour_id`
- `date`
- `time`
- `capacity`
- `booked_count`
- `status` (default `available`)

`tours` contains authoritative `business_id`, `price`, `status`.

### Booking

`bookings` contains client/business, polymorphic `object_id`, dates, guest count, total, payment status, status and JSON metadata. The recovered demo contract stores `booking_type='tour'` and `object_id=tour.id`.

The live project currently has no `room_availability` or `tour_schedules` rows, so inventory must be initialized before a functional staging test.

## Current gap

There is no proven atomic transaction that locks inventory and writes the booking together. A direct client insert can create a booking row, but it does not itself prove or reserve room/tour capacity. Therefore the current schema can still oversell under concurrent requests unless all writes are routed through an atomic authority.

## Draft solution

`007_booking_transaction_core_DRAFT_NOT_APPLIED.sql` prepares two RPCs:

- `create_stay_booking_atomic(...)`
- `create_tour_booking_atomic(...)`

Both:

- take caller identity from `auth.uid()`;
- never accept `client_id` or total from the caller;
- calculate total from current DB prices;
- lock the inventory rows with `FOR UPDATE`;
- update inventory and insert booking in one transaction;
- write the initial booking status-history row;
- use a client-scoped idempotency key;
- are `SECURITY DEFINER` only because inventory/history writes must remain server-authoritative;
- explicitly revoke default/public/anon execute and grant execute to `authenticated` only;
- fix `search_path`.

## Stay semantics in the draft

Dates use `[start_date, end_date)`: checkout day is not consumed.

The function fails closed when any requested night lacks an initialized availability row. This avoids inventing availability from a room record alone.

The draft does not change availability `status` when count reaches zero; availability is determined by both `status='available'` and `available_count > 0`. This avoids inventing an unconfirmed sold-out status value.

## Tour semantics in the draft

Capacity authority is the locked `tour_schedules` row. The booking keeps the recovered contract `object_id=tour.id`; the chosen `tour_schedule_id` is stored in booking metadata until a later schema decision normalizes this relationship.

## Explicitly not implemented yet

- booking cancellation inventory release;
- payment capture/authorization;
- refund rules;
- partner acceptance/rejection rules;
- hold expiration;
- no-show logic;
- changes to booking status vocabulary.

Those flows affect money/inventory and require separate deterministic transitions rather than implicit UI writes.

## Required staging proof

The stay concurrency test must send simultaneous requests against one initialized room/date range with one unit available. Exactly one unique booking may commit; inventory must never become negative; retrying the winning idempotency key must return the same booking without a second decrement.

The tour test must send simultaneous requests whose participant sum exceeds schedule capacity. The committed sum must never exceed capacity, and a repeated successful idempotency key must not increment twice.

## Safety state

No live SQL was applied. No booking, inventory, payment, Auth, Storage or deployment record was changed during preparation of this draft.

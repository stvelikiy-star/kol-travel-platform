# KÖL Safe MVP Launch — 2026-09-24

## Launch scope

Safe MVP only:

- public catalog;
- authenticated client request intake;
- manual operator confirmation through Admin Support;
- no claim of confirmed booking, paid order, automated payment, or delivery.

## Test Supabase changes applied

Project: `kol-travel-platform-test` / `mphruawzozrpwcjgejhs`.

Applied migrations:

1. `security_hardening_phase1_20260924`
2. `auth_profile_rls_minimal_20260924`
3. `mvp_support_read_rls_20260924`
4. `client_support_runtime_20260924`
5. `admin_support_lifecycle_20260924`

Verified:

- public catalog anon reads are limited to the current allowlist;
- client/partner/courier/admin RLS isolation was simulated with authenticated JWT claims;
- client Support RPC creates one audited request atomically;
- admin Support RPC can move `open -> in_progress -> resolved -> closed`;
- official 021 and 022 verification SQL passed.

## Deliberately not enabled

The following remain out of the MVP launch path:

- payment processing;
- delivery automation;
- `create_order_atomic`;
- `create_stay_booking_atomic`;
- `create_tour_booking_atomic`;
- public booking inventory RPCs;
- any UI that claims a paid or confirmed order/booking.

Current test DB has one room but no `room_availability` rows and no `tour_schedules` rows, so real-time booking availability cannot be represented truthfully yet.

## Backup status

A backup/restore workflow exists in GitHub, but a fresh 2026-09-24 live backup was **not** started from this session because the connected GitHub action surface cannot create the required `workflow_dispatch` event.

Do not describe the current DB as freshly backed up until that workflow is manually dispatched and succeeds.

## MVP request flow

Food/Shop:

`catalog -> cart -> /checkout -> order_request support ticket -> /admin/support -> manual operator confirmation`

Stay/Tour without verified inventory:

`detail -> booking_request support ticket -> /admin/support -> manual operator confirmation`

The Support queue is the operational request ledger for this MVP. It is not a payment ledger and does not itself create a booking/order record.

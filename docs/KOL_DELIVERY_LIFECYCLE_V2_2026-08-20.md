# KÖL — Delivery Lifecycle V2

Prepared: 2026-08-20

## Status

Source-only draft. No live Supabase delivery row, assignment, courier profile, payment status or order status was changed.

## Fresh live facts

- one recovered demo delivery exists in `courier_assigned`;
- `deliveries.assigned_courier_id` points to the demo courier;
- `courier_assignments` still has no normalized active row;
- the same courier profile is still `online` instead of `busy`;
- authenticated still has direct INSERT/UPDATE/DELETE table grants on delivery operational tables;
- the existing delivery UPDATE policy is row-scoped but cannot protect individual columns.

## V2 transaction model

`012_delivery_lifecycle_DRAFT_NOT_APPLIED.sql` restores the atomic dispatcher/courier lifecycle:

`delivery_pending → courier_assigned → courier_accepted → courier_to_partner → arrived_at_partner → picked_up → courier_to_client → arrived_at_client → delivered`

Courier progression cannot set failure/cancellation, mutate assignment/address/risk, or touch payment truth.

`012a_delivery_assignment_consistency_DRAFT_NOT_APPLIED.sql` repairs the current recovered demo mismatch without hard-coded IDs and makes active couriers `busy`.

`012b_delivery_role_consistency_hardening_DRAFT_NOT_APPLIED.sql` adds the V2 boundary:

- original 012 RPC bodies are moved behind private internal functions;
- public assignment wrapper requires dispatcher/super_admin;
- target must have active `courier` role and courier profile;
- public progress wrapper requires an active courier role/profile;
- `is_assigned_courier()` recognizes normalized `in_progress` assignments instead of stale `active`;
- deferred constraint triggers require exactly one matching active assignment for each active delivery;
- active assigned courier must have active courier role/profile and `busy` availability;
- pending/terminal deliveries cannot retain active normalized assignments;
- courier profile cannot be deleted or switched away from `busy` while an active delivery remains.

## Application boundary

Server actions repeat the role gate before calling the authenticated Supabase RPC. The database remains authoritative; frontend checks are defense in depth only.

`src/lib/data/delivery.ts` includes `arrived_at_partner` and `arrived_at_client`, matching the database state machine.

## Explicitly out of scope

- delivery price / fee formula;
- creating a delivery from an order;
- high-risk reassignment after acceptance;
- force-complete / failure workflows;
- GPS or proof-of-delivery;
- courier payouts;
- payment/refund behavior.

Those require separate business or operational contracts and are not invented here.

## Required staging proof

1. Apply 012, then 012a, then 012b only after accepted backup/baseline.
2. Prove the recovered demo delivery gains exactly one matching normalized assignment and courier becomes busy.
3. Prove non-dispatcher assignment is denied.
4. Prove target without active courier role/profile is denied.
5. Prove wrong/revoked courier cannot progress delivery.
6. Prove status skipping and failure forcing are denied.
7. Prove each valid step commits delivery + assignment + history + audit atomically.
8. Prove pickup/delivered order-state projection is correct and payment status is unchanged.
9. Prove terminal delivery has no active assignment and courier returns online only after its last active delivery.

No production deployment or live SQL apply was performed by this source change.

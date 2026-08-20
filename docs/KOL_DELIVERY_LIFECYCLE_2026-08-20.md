# KÖL — Delivery Lifecycle Core

Prepared: 2026-08-20

## Status

Source-only draft. No live delivery, courier assignment, order or Supabase row was changed.

## Verified recovery state

- live database currently contains one demo delivery;
- the demo delivery is `courier_assigned` to the recovery courier;
- the related food order is `ready_for_pickup`, payment remains `pending`;
- courier profile availability uses `online/offline/busy`;
- authenticated currently has broad table grants on delivery operational tables;
- the existing courier UPDATE policy restricts which row may be updated but cannot restrict which columns the courier changes.

## Canonical physical state machine

`courier_assigned → courier_accepted → courier_to_partner → arrived_at_partner → picked_up → courier_to_client → arrived_at_client → delivered`

`delivery_pending` is pre-assignment. `delivery_failed` is terminal/high-risk and is intentionally not reachable through the courier progress RPC.

## Transaction boundaries

### Dispatcher assignment

`assign_courier_atomic`:

- dispatcher/super-admin only;
- locks the delivery row;
- requires an online courier;
- allows safe reassignment only before courier acceptance;
- writes assignment + delivery status + history + audit atomically;
- marks newly assigned courier busy;
- releases previous courier to online only when no other active delivery exists.

### Courier progress

`courier_transition_delivery_atomic`:

- only the currently assigned courier can call it successfully;
- only the exact next status is accepted;
- same-status replay is idempotent;
- courier cannot change assignment/address/risk/payment/items/prices;
- pickup moves an eligible order to `delivering`;
- delivery moves an eligible order to `completed`;
- order history + delivery history + audit are part of the same DB transaction;
- payment status is never touched.

## Deliberately out of scope

- delivery fee calculation;
- automatic delivery-row creation during checkout;
- reassign after courier acceptance/pickup;
- force complete;
- failed/cancelled delivery handling;
- GPS/evidence/proof-of-delivery rules;
- courier payouts.

Those require separate business/security contracts.

## Staging proof required

Role isolation, wrong-courier rejection, step-skipping rejection, replay idempotency, concurrent assignment, reassignment boundary, order-state synchronization, payment immutability, history/audit atomicity, and courier availability restoration must all be tested before apply.

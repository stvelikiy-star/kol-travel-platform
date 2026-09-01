# KÖL Partner Order Lifecycle Runtime Notes

Status: implementation branch only; not live-applied.

## Implemented scope

- Client checkout creates real Food/Shop **pickup** orders through `create_order_atomic`.
- Browser does not supply `client_id`, totals, payment status, discounts or delivery fee.
- Partner order lifecycle uses `public.partner_order_action_atomic` (SECURITY INVOKER) -> private scoped implementation.
- Canonical operational path: `new -> accepted_by_partner -> preparing -> ready_for_pickup`.
- Food rejection is allowed only from `new` while payment is `pending`.
- Shop rejection remains fail-closed until an atomic restock contract is reviewed.
- Issue and cancellation-request actions are audit-only.
- Partner reads order item snapshots through the existing RLS-scoped order access model.
- Pickup orders do not create delivery rows.

## Explicit exclusions

- delivery fee/address authority and delivery-row creation;
- paid-order rejection/refund;
- shop rejection/restock;
- cancellation execution;
- payment provider activation;
- live Supabase mutation;
- production readiness flags.

## Required merge evidence

- exact-head KOL CI PASS;
- exact-head Public Flows PASS;
- exact-head Visual QA PASS;
- exact-head Local Supabase PASS, including `partner-order-runtime`;
- repeated Local workflow on the same accepted SHA;
- post-merge main CI PASS.

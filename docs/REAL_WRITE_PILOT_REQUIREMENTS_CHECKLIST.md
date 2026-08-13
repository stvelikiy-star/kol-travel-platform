# Real Write Pilot Requirements Checklist

Stage: 12L-2 - Real Write Pilot Requirements Checklist.

Selected future pilot:

- `markOrderReadyForPickupAction(orderId)`

Current demo action:

- `markOrderReadyForPickupDemoAction(orderId)`

This document defines requirements only. Do not implement the real write yet, do not connect Supabase, do not mutate mock data, and do not create a real server action in this stage.

`DATA_SOURCE_MODE=mock` remains the default. `ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## 1. Goal

- Define exact requirements before implementing first real write.
- Avoid unsafe status updates.
- Protect payment, cancellation and delivery statuses.
- Keep rollback to demo/mock mode.
- Make the first write small enough to audit and reverse safely.

## 2. Preconditions Before Implementation

- Supabase test project exists.
- Schema applied.
- Seed data verified.
- RLS verified.
- Auth roles planned.
- Partner ownership checks planned.
- Audit log table confirmed.
- Orders table fields confirmed.
- Status enum values confirmed.
- Mock fallback remains available.

## 3. Required Environment Later

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` server-only if needed
- `DATA_SOURCE_MODE=supabase` only during controlled test
- `ALCOHOL_MODULE_ENABLED=false`

The service role key must never be imported into client components or exposed to the browser.

## 4. Required Order Fields

Confirm actual schema has these fields or equivalents:

- `id`
- `partner_id`
- `status`
- `payment_status`
- `delivery_status` or delivery relation if used
- `ready_for_pickup_at`
- `updated_at`
- `cancelled_at` if used
- `refunded_at` if used

Actual field names must be verified against `supabase/schema` before implementation.

## 5. Allowed Transition

Allowed from:

- `accepted_by_partner`
- `preparing`

Allowed to:

- `ready_for_pickup`

Blocked statuses:

- `new_order`
- `rejected`
- `cancelled`
- `picked_up`
- `courier_to_client`
- `delivered`
- `refunded`
- `admin_required` unless admin flow later

## 6. Auth And Role Checks

Future real action must verify:

- Session exists.
- User role is `partner`.
- Partner profile exists.
- `partner_id` is linked to user.
- Order belongs to this partner.
- Partner is not blocked/suspended if such status exists.

## 7. Safety Checks

Future real action must not:

- Change `payment_status`.
- Change price.
- Change order items.
- Assign courier.
- Mark `picked_up`.
- Mark `delivered`.
- Cancel order.
- Refund order.
- Enable alcohol module.

## 8. Audit Requirements

Future real action must create audit log:

- `actor_user_id`
- `actor_role = partner`
- `action_type = mark_order_ready_for_pickup`
- `target_table = orders`
- `target_id = orderId`
- `before_state`
- `after_state`
- `risk_level = medium`
- `human_approval_required = false`
- `created_at`

The audit log must capture the order state before and after the transition.

## 9. Error Cases

Safe user-facing errors to document later:

- Not authenticated.
- Wrong role.
- Order not found.
- Order belongs to another partner.
- Invalid status transition.
- Order already cancelled.
- Payment/refund conflict.
- Supabase/RLS denied.
- Unexpected error.

No raw database errors should be shown to user.

## 10. Test Checklist Later

- Valid partner can mark own `preparing` order ready.
- Valid partner can mark own `accepted_by_partner` order ready.
- Partner cannot update another partner order.
- Courier cannot call partner action.
- Client cannot call partner action.
- Unauthenticated user cannot call action.
- Wrong status is blocked.
- `payment_status` remains unchanged.
- Audit log is created.
- Rollback to mock still works.

## 11. Rollback

If implementation fails:

- Keep demo action available.
- Keep `DATA_SOURCE_MODE=mock`.
- Revert button to demo wiring.
- Run `npm run build`.
- Verify `/partner/orders`.
- Do not delete mock data.
- Do not delete Supabase test data.

## 12. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- Action must not enable alcohol module.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- Future activation requires legal review, licensing, partner verification and `super_admin` approval.
- Alcohol-related request is critical risk.

## 13. Next Stages

Recommended next stages:

1. `12L-3 Real Write Pilot Pseudocode`
2. `12L-4 Real Write Pilot Test Plan`
3. `12M Auth + Role Implementation Plan`
4. `12N Audit Log Implementation Plan`

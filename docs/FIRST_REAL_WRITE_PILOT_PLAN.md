# First Real Write Pilot Plan

Stage: 12L-1 - First Real Write Pilot Plan.

This plan defines the first future real backend write pilot. It is planning only: do not implement the real write yet, do not connect Supabase, do not mutate mock data, and do not create a real server action in this stage.

`DATA_SOURCE_MODE=mock` remains the default. `ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## 1. Goal

- Plan the first safe real backend write.
- Start with one low/medium-risk partner action.
- Verify auth, role, ownership, status transition and audit.
- Keep rollback to mock mode.
- Avoid payment, refund, cancellation and delivery-completion writes in the first pilot.

## 2. Selected First Pilot

Future action:

- `markOrderReadyForPickupAction(orderId)`

Current demo action:

- `markOrderReadyForPickupDemoAction(orderId)`

UI location:

- `/partner/orders`
- `/partner/orders/[id]` if present

Button:

- "Готов к выдаче"

## 3. Why This Action Is First

- Operationally important.
- No payment change.
- No refund.
- No cancellation.
- No delivery completion.
- No high-risk approval required in normal case.
- Clear status transition.
- Easy to audit.
- Fits the partner responsibility zone: partner controls preparation and readiness only.

## 4. Future Allowed Status Transition

Allowed from:

- `accepted_by_partner`
- `preparing`

Allowed to:

- `ready_for_pickup`

Not allowed from:

- `new_order`
- `rejected`
- `cancelled`
- `picked_up`
- `courier_to_client`
- `delivered`
- `refunded`
- `admin_required` unless admin approves later

## 5. Required Checks Before Real Write

- User is authenticated.
- User role is `partner`.
- `partner_id` exists.
- Order exists.
- Order belongs to partner.
- Order status is `accepted_by_partner` or `preparing`.
- Payment status is not modified.
- Delivery status is not force-changed.
- Order is not cancelled.
- `ALCOHOL_MODULE_ENABLED=false`.

## 6. Required Database Write Later

Update `orders` table:

- `status = ready_for_pickup`
- `ready_for_pickup_at = now()`
- `updated_at = now()`

If `deliveries` table exists:

- Delivery status may remain `pending_assignment` or `waiting_for_courier` according to schema.
- Do not assign courier here.
- Do not mark `picked_up` here.
- Do not mark `delivered` here.

## 7. Audit Log Requirement

Create audit log later with:

- `actor_user_id`
- `actor_role = partner`
- `action_type = mark_order_ready_for_pickup`
- `target_table = orders`
- `target_id = orderId`
- `before_state`
- `after_state`
- `reason` optional
- `risk_level = medium`
- `created_at`

## 8. Notifications Later

Not in first implementation, but plan:

- Notify admin/AI dispatcher.
- Notify courier pool if assignment is ready.
- Notify client that order is preparing/ready depending business rules.
- Telegram/n8n later only.

## 9. UI Feedback Later

On success:

- Show real success message.
- Show "Заказ готов к выдаче".
- Show next step "Ожидает курьера".

On failure:

- Safe error message.
- No raw Supabase error.
- No service role key exposure.
- If wrong status, show "Этот заказ нельзя перевести в готов к выдаче".

## 10. Rollback

If pilot breaks:

- Keep demo action available.
- Set `DATA_SOURCE_MODE=mock`.
- Revert UI button to demo wiring.
- Run `npm run build`.
- Verify `/partner/orders`.
- Do not delete mock data.
- Do not delete Supabase test data.

## 11. Safety Restrictions

- Partner cannot change payment status.
- Partner cannot force refund.
- Partner cannot cancel accepted order directly.
- Partner cannot assign courier.
- Partner cannot mark `picked_up`.
- Partner cannot mark `delivered`.
- Partner cannot enable alcohol module.

## 12. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- Action must not enable alcohol module.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- Future activation requires legal review, licensing, partner verification and `super_admin` approval.
- Alcohol-related request is critical risk.

## 13. Recommended Next Stages

Recommended next stages:

1. `12L-2 Real Write Pilot Requirements Checklist`
2. `12L-3 Real Write Pilot Pseudocode`
3. `12L-4 Real Write Pilot Test Plan`
4. `12M Auth + Role Implementation Plan`
5. `12N Audit Log Implementation Plan`

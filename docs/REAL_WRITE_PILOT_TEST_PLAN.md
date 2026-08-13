# Real Write Pilot Test Plan

Stage: 12L-4 - Real Write Pilot Test Plan.

Selected future pilot:

- `markOrderReadyForPickupAction(orderId)`

Current demo action:

- `markOrderReadyForPickupDemoAction(orderId)`

This document is a future test plan only. Do not implement the real write yet, do not connect Supabase, do not mutate mock data, and do not create a real server action in this stage.

`DATA_SOURCE_MODE=mock` remains the default. `ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## 1. Goal

- Define how to test the first real write safely later.
- Verify role, ownership, status transition and audit log.
- Protect payment/cancellation/delivery fields.
- Keep rollback to mock/demo mode.
- Confirm the first write does not expand beyond partner readiness status.

## 2. Future Action Under Test

Future action:

- `markOrderReadyForPickupAction(orderId)`

Button:

- "Готов к выдаче"

Future pages:

- `/partner/orders`
- `/partner/orders/[id]` if present

## 3. Required Test Setup Later

- Supabase test project exists.
- SQL schema applied.
- RLS verified.
- Seed data verified.
- Test partner user exists.
- Test order belongs to partner.
- Test order status is `accepted_by_partner` or `preparing`.
- `audit_logs` table exists.
- `DATA_SOURCE_MODE` can be switched back to `mock`.

## 4. Positive Test Cases

### Test 1: Partner Marks Own Accepted Order Ready

Action:

- Partner marks own `accepted_by_partner` order `ready_for_pickup`.

Expected:

- Order status becomes `ready_for_pickup`.
- `ready_for_pickup_at` is set.
- `updated_at` changes.
- `payment_status` unchanged.
- Audit log created.

### Test 2: Partner Marks Own Preparing Order Ready

Action:

- Partner marks own `preparing` order `ready_for_pickup`.

Expected:

- Order status becomes `ready_for_pickup`.
- `ready_for_pickup_at` is set.
- `updated_at` changes.
- `payment_status` unchanged.
- Audit log created.

## 5. Negative Test Cases

- Unauthenticated user tries action -> blocked.
- Client tries action -> blocked.
- Courier tries action -> blocked.
- Partner tries another partner order -> blocked.
- Order not found -> safe error.
- Order status `new_order` -> blocked.
- Order status `cancelled` -> blocked.
- Order status `picked_up` -> blocked.
- Order status `delivered` -> blocked.
- Order refunded -> blocked.
- RLS denies access -> safe error.

## 6. Safety Field Checks

After action verify:

- `payment_status` did not change.
- Price did not change.
- `order_items` did not change.
- Courier assignment did not happen.
- Delivery was not marked `picked_up`.
- Delivery was not marked `delivered`.
- Cancellation fields did not change.
- Refund fields did not change.
- Alcohol module remains disabled.

## 7. Audit Log Checks

Verify audit record contains:

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

## 8. UI Test Checks Later

- Button click shows real success only after real write succeeds.
- Success wording: "Заказ готов к выдаче".
- Next step visible: "Ожидает курьера".
- No wording about payment change.
- Safe error shown if blocked.
- No raw Supabase error shown.
- No wording implies courier pickup or delivery completion.

## 9. Build And Runtime Checks

- `npm run build` passes.
- `npm run dev` works.
- `/partner/orders` opens.
- No hydration error.
- No service role key exposed.
- No env required in mock mode.

## 10. Rollback Test

- Switch `DATA_SOURCE_MODE=mock`.
- Restart dev server.
- Verify `/partner/orders` works.
- Demo button wiring can be restored if needed.
- Mock data remains intact.
- Supabase test data is not deleted.

## 11. Manual SQL Verification Examples

Example queries:

```sql
select status, ready_for_pickup_at, payment_status
from orders
where id = '<orderId>';

select *
from audit_logs
where target_id = '<orderId>'
order by created_at desc;
```

Queries are examples only. Actual table and field names must match schema.

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

1. `12M Auth + Role Implementation Plan`
2. `12N Audit Log Implementation Plan`
3. `12O First Real Write Implementation Preparation`
4. `12P First Real Write Implementation Pilot`

# Stage 12R-5 - First Real Write QA

## QA Scope

Target action:

- `markOrderReadyForPickupAction(orderId)`
- `markOrderReadyForPickupDemoAction(orderId)` remains available

Target UI:

- `/partner/orders`
- Controlled pilot button: `Готов к выдаче — real test`
- Seeded test order: `50000000-0000-0000-0000-000000000001`

This QA does not add new actions, wire more buttons, protect routes, create login UI, change payments, change delivery completion flow or mutate mock data.

## Files Inspected

- `src/app/actions/partner/partnerOrders.ts`
- `src/app/partner/orders/page.tsx`
- `src/components/shared/DemoActionResultPanel.tsx`
- `README.md`

## Current Wiring Check

- `markOrderReadyForPickupAction(orderId)` exists.
- `markOrderReadyForPickupDemoAction(orderId)` still exists.
- Demo action was not removed.
- Only one controlled real pilot button is wired on `/partner/orders`.
- Existing demo fallback remains available through `PartnerOrdersDemoActions`.
- Real pilot is gated by `DATA_SOURCE_MODE=supabase`.
- Default mode remains `DATA_SOURCE_MODE=mock`.
- In mock mode the real pilot button is disabled and the server-side pilot guard also blocks execution.
- No payment, refund, cancellation or delivery-complete buttons were wired.

## Safe Update Field Check

The current real action patches only:

```sql
status = 'ready_for_pickup'
updated_at = now()
```

The current action does not patch:

- `payment_status`
- `subtotal`
- `delivery_fee`
- `discount`
- `total`
- order items
- `client_id`
- `business_id`
- courier fields
- picked up fields
- delivered fields
- cancelled fields
- refunded fields
- `alcohol_module_settings`
- alcohol-related fields

Known limitation: `ready_for_pickup_at` is not written in this pilot because the current action does not introspect optional columns. If that column is added and confirmed in schema, it can be included in a later tightly scoped stage.

## Status Transition Check

Allowed source statuses:

- `preparing`
- `accepted_by_partner`

Expected target status:

- `ready_for_pickup`

Blocked statuses:

- `new`
- `rejected`
- `cancelled`
- `picked_up`
- `courier_to_client`
- `delivered`
- `refunded`
- `admin_required`
- unknown status

## Safe Error Handling Check

The action returns safe result codes/messages and should not expose raw Supabase errors, SQL details, service role keys, auth tokens or private env values.

The `/partner/orders` result renderer maps known safe codes to safe UI messages before showing the result panel. This keeps incomplete or stale query-string messages from appearing as raw/internal text.

Expected safe failures include:

- `invalid_order_id`
- `profile_not_found`
- `ownership_failed`
- `order_not_found`
- `invalid_status_transition`
- `database_update_failed`
- `audit_insert_failed`
- `server_error`

Planned future auth-related safe failures:

- `not_authenticated`
- `not_authorized`

Validation fix: deterministic Supabase seed UUIDs such as `50000000-0000-0000-0000-000000000001` are accepted by format. The validator no longer requires an RFC version nibble, because the seed data uses fixed test IDs.

## Audit Behavior Check

If the action succeeds, the pilot attempts to insert an audit row into `public.audit_logs`.

Expected audit intent:

- actor role: `partner`
- action: `mark_order_ready_for_pickup`
- target table/entity: `orders`
- target id: `orderId`
- risk level: `medium`
- human approval required: `false`

Known limitation: the current seed/schema audit table uses existing field names such as `actor_role`, `action`, `entity_type` and `entity_id`. The future normalized fields `action_type`, `target_table`, `target_id`, `risk_level` and `human_approval_required` should be verified against the final schema before production hardening.

Current pilot audit mapping:

- `actor_role = partner`
- `action = mark_order_ready_for_pickup`
- `entity_type = orders`
- `entity_id = orderId`

If an audit insert succeeds, the UI can display `auditLogId`. If audit insert fails, the action returns `audit_insert_failed` with a safe message.

## Manual Supabase SQL Checks

Run these manually in the Supabase TEST project SQL Editor only.

Before clicking:

```sql
select
  id,
  business_id,
  type,
  status,
  payment_status,
  subtotal,
  delivery_fee,
  discount,
  total,
  updated_at
from public.orders;
```

After clicking:

```sql
select
  id,
  business_id,
  type,
  status,
  payment_status,
  subtotal,
  delivery_fee,
  discount,
  total,
  updated_at
from public.orders;
```

Audit check:

```sql
select
  id,
  actor_role,
  action,
  entity_type,
  entity_id,
  created_at
from public.audit_logs
order by created_at desc
limit 5;
```

If the final audit schema contains normalized names, use this version instead:

```sql
select
  id,
  actor_role,
  action_type,
  target_table,
  target_id,
  risk_level,
  human_approval_required,
  created_at
from public.audit_logs
order by created_at desc
limit 5;
```

Alcohol check:

```sql
select *
from public.alcohol_module_settings;
```

## Expected SQL Result After Successful Action

- `orders.status = ready_for_pickup`
- `orders.payment_status` remains `pending`
- `orders.total` remains `800.00` or the original value
- `orders.business_id` remains `20000000-0000-0000-0000-000000000001`
- `audit_logs` has a new `mark_order_ready_for_pickup` row if audit insert works
- `alcohol_module_settings` remains disabled

## Actual Result Placeholders

Use these after the manual Supabase test:

- Before status:
- After status:
- Payment status unchanged:
- Total unchanged:
- Business id unchanged:
- Audit row created:
- Audit log id:
- Alcohol module disabled:
- UI showed safe result:
- Raw errors exposed:

## Rollback QA

If the pilot breaks:

1. Revert only the `/partner/orders` UI pilot wiring if needed.
2. Keep `markOrderReadyForPickupDemoAction(orderId)`.
3. Set `DATA_SOURCE_MODE=mock`.
4. If the test order changed during manual testing, reset it:

```sql
update public.orders
set
  status = 'preparing',
  updated_at = now()
where
  business_id = '20000000-0000-0000-0000-000000000001'
  and status = 'ready_for_pickup';
```

5. Run `npm run build`.
6. Verify `/partner/orders` opens.

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- Alcohol sales and delivery remain disabled.
- The action does not touch `alcohol_module_settings`.
- The UI does not enable alcohol module.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- Super admin cannot activate alcohol without legal review, licensing and partner verification.

## Final QA Decision

Current code-level QA decision: safe for a controlled TEST-project pilot behind `DATA_SOURCE_MODE=supabase`, with demo fallback preserved.

Manual Supabase execution is still required before considering the first real write production-ready.

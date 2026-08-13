# Stage 12R-6 - First Real Write Rollback Check

## Rollback Scope

Rollback target:

- `markOrderReadyForPickupAction(orderId)`
- `/partner/orders` ready-for-pickup real pilot button
- demo fallback for partner order actions

This rollback check does not add real actions, wire more buttons, protect routes, create login UI, change payments, change delivery completion flow, mutate mock data or enable alcohol module.

## Demo Fallback Status

Confirmed:

- `markOrderReadyForPickupDemoAction(orderId)` still exists.
- The demo action remains available in `src/app/actions/partner/partnerOrders.ts`.
- `/partner/orders` still renders `PartnerOrdersDemoActions`.
- UI can return to demo behavior without deleting the real action.
- The result panel remains safe for demo and real pilot results.

## DATA_SOURCE_MODE Safety

Default mode remains:

```env
DATA_SOURCE_MODE=mock
ALCOHOL_MODULE_ENABLED=false
```

Rollback safety:

- In mock mode, the real pilot button is disabled.
- The server-side pilot action also checks `DATA_SOURCE_MODE` before calling `markOrderReadyForPickupAction(orderId)`.
- The app remains usable in mock mode without Supabase real writes.
- Demo fallback remains the normal local path.

## UI Rollback Steps

If the `/partner/orders` pilot UI needs rollback:

1. Disconnect or remove only the real pilot card/button: `Готов к выдаче — real test`.
2. Keep `PartnerOrdersDemoActions` mounted.
3. Keep `markOrderReadyForPickupDemoAction(orderId)`.
4. Keep `DemoActionResultPanel` safe for demo results.
5. Do not remove `markOrderReadyForPickupAction(orderId)` unless a later stage explicitly requires it.
6. Run `npm run build`.
7. Open `/partner/orders` and verify the demo order action path is still usable.

## Database Rollback SQL

If the Supabase TEST project order was changed to `ready_for_pickup`, reset only the test order:

```sql
update public.orders
set
  status = 'preparing',
  updated_at = now()
where
  business_id = '20000000-0000-0000-0000-000000000001'
  and status = 'ready_for_pickup';
```

This rollback SQL must not touch payment, totals, order items, courier fields, cancellation fields, refund fields or alcohol settings.

## Audit Log Policy

Do not delete audit logs by default.

Audit logs are evidence of testing and should remain available for verification. If the test project needs a full reset, reset the test schema instead of manually deleting individual audit rows.

## Full Test Project Reset Path

Use this only in a Supabase TEST project:

1. Reset the public schema.
2. Run `supabase/schema/001_initial_schema.sql`.
3. Run `supabase/schema/002_rls_policies_draft.sql`.
4. Run `supabase/schema/003_seed_demo_data_draft_FIXED.sql`.
5. Recreate or verify the partner profile if needed.
6. Confirm the test order status is `preparing`.
7. Keep `DATA_SOURCE_MODE=mock` until ready for another controlled test.

## Rollback Must Not Do

Rollback must not:

- delete production data
- touch `payment_status`
- touch `subtotal`, `delivery_fee`, `discount` or `total`
- change order items
- assign courier
- mark `picked_up`
- mark `delivered`
- cancel order
- refund order
- enable alcohol module

## Safe Error Requirements

If the real action fails, UI should show safe errors only:

- `invalid_order_id`
- `not_authenticated`
- `not_authorized`
- `profile_not_found`
- `ownership_failed`
- `order_not_found`
- `invalid_status_transition`
- `database_update_failed`
- `audit_insert_failed`
- `server_error`

The UI must never show:

- raw Supabase error
- SQL details
- service role key
- auth token
- private env values

## Local Recovery Checklist

1. Set `DATA_SOURCE_MODE=mock`.
2. Keep `ALCOHOL_MODULE_ENABLED=false`.
3. Run `npm run build`.
4. Run `npm run dev` if local browser verification is needed.
5. Open `/partner/orders`.
6. Verify the page loads.
7. Verify the existing demo action path is usable.
8. Confirm no Supabase write is triggered in mock mode.

## Supabase Test Data Recovery Check

Manual SQL check:

```sql
select
  id,
  business_id,
  type,
  status,
  payment_status,
  total,
  updated_at
from public.orders;
```

Expected rollback state:

- `status = preparing`
- `payment_status = pending`
- `total` unchanged
- `business_id` unchanged

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- Alcohol sales and delivery remain disabled.
- Rollback must not touch `alcohol_module_settings`.
- The real action must not touch `alcohol_module_settings`.
- UI must not enable alcohol module.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- Super admin cannot activate alcohol without legal review, licensing and partner verification.

## Final Rollback Decision

Rollback path is safe for the controlled first real write pilot.

The safest immediate rollback remains one environment change:

```env
DATA_SOURCE_MODE=mock
```

The demo fallback remains available, and the real pilot can be disconnected from `/partner/orders` without deleting the real action implementation.

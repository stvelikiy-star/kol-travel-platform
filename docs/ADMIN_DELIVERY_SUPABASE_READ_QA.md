# Stage 14-3 - Admin Delivery Supabase Read QA

## QA Scope

Target page:

- `/admin/delivery`

Target read path:

- `getAdminDeliveryReadResult()`
- `getAdminDeliveryOrdersFromSupabase()`

This QA does not add new reads beyond admin delivery, add writes, remove mock mode, remove demo actions, protect routes, create login UI, change payments or enable alcohol module.

## Files Inspected

- `src/app/admin/delivery/page.tsx`
- `src/lib/data/admin-delivery-read.ts`
- `src/lib/data/admin-delivery-supabase.ts`
- `docs/ADMIN_DELIVERY_SUPABASE_READ_UI_WIRING.md`

## Code-Level Verification

Confirmed:

- `/admin/delivery` reads through `getAdminDeliveryReadResult()`.
- `DATA_SOURCE_MODE=mock` returns mock admin delivery data.
- `DATA_SOURCE_MODE=supabase` calls the Supabase admin delivery adapter.
- Supabase adapter uses `method: "GET"`.
- Supabase adapter does not use `POST`, `PATCH` or `DELETE`.
- Safe fallback exists.
- UI labels exist:
  - `Mock data mode`
  - `Supabase read pilot`
  - `Fallback to mock data`
- Existing admin demo buttons remain demo-only.
- Page load does not call any admin write action.

## Mock Mode QA

Manual steps:

1. Set:

```env
DATA_SOURCE_MODE=mock
ALCOHOL_MODULE_ENABLED=false
```

2. Restart dev server.
3. Open [http://localhost:3000/admin/delivery](http://localhost:3000/admin/delivery).

Expected:

- page opens
- mock/demo admin delivery data appears
- `Mock data mode` label is visible
- no Supabase read is required
- no crash
- no raw errors
- demo buttons remain demo-only

Actual result:

- Page opens:
- Label:
- Mock/demo data visible:
- Demo buttons visible:
- Raw errors exposed:
- Issues:

## Supabase Read Mode QA

Manual steps:

1. Set:

```env
DATA_SOURCE_MODE=supabase
ALCOHOL_MODULE_ENABLED=false
```

2. Restart dev server.
3. Open [http://localhost:3000/admin/delivery](http://localhost:3000/admin/delivery).

Expected:

- page opens
- `Supabase read pilot` label is visible if read succeeds
- fallback label appears safely if read fails
- Supabase order appears if read succeeds

Expected order:

- order id: `50000000-0000-0000-0000-000000000001`
- business_id: `20000000-0000-0000-0000-000000000001`
- payment_status: `pending`
- total: `800.00`
- status: current DB status
- partner title appears if embedded partner read succeeds

Actual result:

- Page opens:
- Label:
- Order id:
- Business id:
- Partner title:
- Status:
- Payment status:
- Total:
- Fallback used:
- Safe code:
- Issues:

## No Writes On Page Load

Refreshing `/admin/delivery` must not change:

- `orders.status`
- `orders.payment_status`
- `orders.total`
- `audit_logs` count
- `alcohol_module_settings`

The admin delivery read pilot must not:

- assign courier
- reassign courier
- mark picked up
- mark delivered
- cancel order
- refund order
- update payment
- create audit logs
- enable alcohol module

## Manual SQL Checks

Run before and after opening `/admin/delivery` in Supabase mode.

Orders check:

```sql
select
  id::text as order_id,
  business_id::text as business_id,
  status,
  payment_status,
  total,
  updated_at
from public.orders;
```

Audit count:

```sql
select count(*) as audit_count
from public.audit_logs;
```

Alcohol:

```sql
select *
from public.alcohol_module_settings;
```

Expected:

- orders unchanged from read-only page load
- audit count unchanged from read-only page load
- `alcohol_module_settings.is_enabled = false`

## Fallback Test

If Supabase read fails:

- UI should not crash.
- UI should fallback to mock if available.
- UI should show safe message/code only.
- UI should not show raw Supabase, SQL or env errors.

Allowed safe codes:

- `supabase_not_configured`
- `read_failed`
- `empty_result`
- `server_error`

## Business Safety

Admin read mode must not:

- assign courier
- reassign courier
- mark picked up
- mark delivered
- cancel order
- refund order
- update payment
- create audit logs
- enable alcohol module

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- Read mode does not touch `alcohol_module_settings`.
- Alcohol sales and delivery remain disabled.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- Super admin cannot activate alcohol without legal review, licensing and partner verification.

## Issues Found

Code-level QA found no blocking issue.

Manual Supabase QA is still required:

- confirm seeded order appears
- confirm no audit count change on page refresh
- confirm no order/payment/total changes
- confirm partner title behavior

## Final Decision

Code-level decision:

- Admin delivery read pilot is safe for manual Supabase TEST-project verification.
- Mock rollback remains available through `DATA_SOURCE_MODE=mock`.
- Do not add admin writes until manual SQL verification is complete.

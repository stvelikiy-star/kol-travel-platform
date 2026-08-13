# Stage 15-4 - Courier Deliveries Supabase Read QA

## QA Scope

Target page:

- `/courier/deliveries`

Target read path:

- `getCourierDeliveriesReadResult()`
- `getCourierDeliveriesFromSupabase()`

This QA does not add new reads beyond `/courier/deliveries`, add writes, remove mock mode, remove demo actions, protect routes, create login UI, change payments or enable the alcohol module.

## Mock Mode QA

Manual steps:

1. Set:

```env
DATA_SOURCE_MODE=mock
ALCOHOL_MODULE_ENABLED=false
```

2. Restart dev server.
3. Open [http://localhost:3000/courier/deliveries](http://localhost:3000/courier/deliveries).

Expected:

- page opens
- mock/demo courier delivery data appears
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
3. Open [http://localhost:3000/courier/deliveries](http://localhost:3000/courier/deliveries).

Expected:

- page opens
- `Supabase read pilot` label is visible if read succeeds
- fallback label appears safely if read fails
- order/delivery-like data from Supabase appears if read succeeds

Expected seeded order:

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

Refreshing `/courier/deliveries` must not change:

- `orders.status`
- `orders.payment_status`
- `orders.total`
- `audit_logs` count
- `alcohol_module_settings`

Courier read mode must not:

- assign courier
- reassign courier
- mark picked up
- mark delivering
- mark delivered
- report issue as real write
- cancel order
- refund order
- update payment
- create audit logs
- enable alcohol module

## Manual SQL Checks

Run before and after opening `/courier/deliveries` in Supabase mode.

Orders:

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

Courier read mode must not:

- assign courier
- reassign courier
- mark picked up
- mark delivering
- mark delivered
- report issue as real write
- cancel order
- refund order
- update payment
- create audit logs
- enable alcohol module

## Issues Found

Code-level QA found no blocking issue.

Manual Supabase QA is still required:

- confirm seeded order appears
- confirm no audit count change on page refresh
- confirm no order/payment/total changes
- confirm partner title behavior

## Final Decision

Code-level decision:

- Courier deliveries read pilot is safe for manual Supabase TEST-project verification.
- Mock rollback remains available through `DATA_SOURCE_MODE=mock`.
- Do not add courier writes until manual SQL verification is complete.

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- Alcohol sales and delivery remain disabled.
- Read mode does not touch `alcohol_module_settings`.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.

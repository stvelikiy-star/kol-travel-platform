# Stage 13-4 - Partner Orders Supabase Read QA

## QA Scope

Target page:

- `/partner/orders`

Target read path:

- `getPartnerOrdersReadResult()`
- `getPartnerOrdersFromSupabase(businessId?)`

This QA stage does not add new reads beyond `/partner/orders`, add writes, remove mock mode, remove demo actions, protect routes, create login UI, change payments or enable alcohol module.

## Files Inspected

- `src/app/partner/orders/page.tsx`
- `src/lib/data/partner-orders-read.ts`
- `src/lib/data/partner-orders-supabase.ts`
- `docs/PARTNER_ORDERS_SUPABASE_READ_UI_PILOT.md`

## Code-Level Verification

Confirmed:

- `/partner/orders` loads orders through `getPartnerOrdersReadResult()`.
- `DATA_SOURCE_MODE=mock` returns mock orders.
- `DATA_SOURCE_MODE=supabase` calls the Supabase read adapter.
- Supabase read adapter uses `method: "GET"`.
- Supabase read adapter does not use `POST`, `PATCH` or `DELETE`.
- Supabase read adapter filters by `business_id`.
- Demo buttons remain available.
- Existing controlled real write pilot remains a separate form action and is not triggered by page load.
- Page label shows `Mock data mode` or `Supabase read pilot`.
- Fallback shows `Mock fallback` and safe code when Supabase read fails.

## Mock Mode QA

Manual steps:

1. Set:

```env
DATA_SOURCE_MODE=mock
ALCOHOL_MODULE_ENABLED=false
```

2. Restart dev server.
3. Open `/partner/orders`.

Expected:

- page opens
- label says `Mock data mode`
- mock/demo data appears
- demo buttons work as before
- real test button is disabled or clearly controlled
- no Supabase read is required

Actual result:

- Page opens:
- Label:
- Mock/demo data visible:
- Demo buttons visible:
- Real test button state:
- Issues:

## Supabase Read Mode QA

Manual steps:

1. Set:

```env
DATA_SOURCE_MODE=supabase
ALCOHOL_MODULE_ENABLED=false
```

2. Restart dev server.
3. Open `/partner/orders`.

Expected:

- page opens
- label says `Supabase read pilot`
- Supabase test order appears if read succeeds
- fallback appears safely if read fails
- no real write occurs from page load

Expected Supabase order:

- order id: `50000000-0000-0000-0000-000000000001`
- business_id: `20000000-0000-0000-0000-000000000001`
- payment_status: `pending`
- total: `800.00`
- status: current DB status

Actual result:

- Page opens:
- Label:
- Order id:
- Business id:
- Status:
- Payment status:
- Total:
- Fallback used:
- Safe code:
- Issues:

## No Writes On Page Load

Refreshing `/partner/orders` must not change:

- `orders.status`
- `payment_status`
- `total`
- `audit_logs`
- `alcohol_module_settings`

The only existing write path on this page remains the explicitly clicked controlled real test button. A normal read-mode page load must not trigger it.

## Manual SQL Checks

Run before and after opening `/partner/orders` in Supabase mode.

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

Audit count check:

```sql
select
  count(*) as audit_count
from public.audit_logs;
```

Alcohol check:

```sql
select *
from public.alcohol_module_settings;
```

Expected before/after:

- order status unchanged unless the controlled write button was clicked separately
- `payment_status` unchanged
- `total` unchanged
- `audit_count` unchanged on page load
- alcohol module remains disabled

## Error And Fallback QA

If Supabase read fails:

- UI should not crash.
- UI should show `Mock fallback`.
- UI should show safe code/message only.
- UI should not show raw Supabase errors.
- UI should not show SQL details.
- UI should not expose env values, auth token or service role key.

Safe codes:

- `supabase_not_configured`
- `read_failed`
- `empty_result`
- `server_error`

## Business Safety

Read mode must not:

- update status
- change `payment_status`
- change `total`
- create audit logs
- assign courier
- cancel order
- refund order
- mark delivered
- enable alcohol

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- Read mode does not touch `alcohol_module_settings`.
- Alcohol sales and delivery remain disabled.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- Super admin cannot activate alcohol without legal review, licensing and partner verification.

## Issues Found

Code-level QA found no blocking issue.

Manual Supabase QA is still required for the live TEST-project read result:

- confirm seeded order appears
- confirm no audit count change on page load
- confirm no payment/status/total change

## Final Decision

Code-level decision:

- Read pilot is safe to test manually in Supabase TEST mode.
- Mock rollback remains available through `DATA_SOURCE_MODE=mock`.
- Do not expand reads or writes until manual SQL verification is complete.

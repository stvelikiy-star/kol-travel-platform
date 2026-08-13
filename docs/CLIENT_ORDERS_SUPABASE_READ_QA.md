# Stage 16-4 - Client Orders Supabase Read QA

## QA Scope

Selected client page:

- `/client/orders`

Current route note:

- `/dashboard/client` and `/dashboard/client/orders` do not exist in the current app.
- The existing client cabinet order route is `/client/orders`.

Target read path:

- `getClientOrdersReadResult()`
- `getClientOrdersFromSupabase()`

This QA does not add new reads beyond `/client/orders`, add writes, remove mock mode, remove demo actions, protect routes, create login UI, change payments or enable the alcohol module.

## Code-Level Verification

Confirmed:

- `docs/CLIENT_ORDERS_SUPABASE_READ_UI_WIRING.md` exists.
- `/client/orders` calls `getClientOrdersReadResult()`.
- `/client/orders` shows safe mode labels:
  - `Mock data mode`
  - `Supabase read pilot`
  - `Fallback to mock data`
- `DATA_SOURCE_MODE=mock` returns mock client orders through the wrapper.
- `DATA_SOURCE_MODE=supabase` calls the controlled Supabase read pilot.
- Supabase read failure falls back to mock data with safe code/message.
- Supabase adapter filters by `client_id`.
- Supabase adapter uses `method: "GET"`.
- Page text states that page load does not change order status, payment, totals, audit logs or alcohol settings.
- Client buttons remain demo-only.

## Mock Mode QA

Manual steps:

1. Set:

```env
DATA_SOURCE_MODE=mock
ALCOHOL_MODULE_ENABLED=false
```

2. Restart dev server.
3. Open [http://localhost:3000/client/orders](http://localhost:3000/client/orders).

Expected:

- page opens
- mock/demo client order data appears
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
3. Open [http://localhost:3000/client/orders](http://localhost:3000/client/orders).

Expected:

- page opens
- `Supabase read pilot` label is visible if read succeeds
- fallback label appears safely if read fails
- order data from Supabase appears if seeded `client_id` matches

Expected seeded order:

- order id: `50000000-0000-0000-0000-000000000001`
- client_id: `00000000-0000-0000-0000-000000000002` if applicable
- business_id: `20000000-0000-0000-0000-000000000001`
- payment_status: `pending`
- total: `800.00`
- status: current DB status
- partner title appears if embedded partner read succeeds

If no data appears:

- document whether the seeded order `client_id` differs
- do not remove `client_id` filtering
- do not broaden to all production data

Actual result:

- Page opens:
- Label:
- Order id:
- Client id:
- Business id:
- Partner title:
- Status:
- Payment status:
- Total:
- Fallback used:
- Safe code:
- Issues:

## No Writes On Page Load

Refreshing `/client/orders` must not change:

- `orders.status`
- `orders.payment_status`
- `orders.total`
- `audit_logs` count
- `alcohol_module_settings`

Client read mode must not:

- place order
- cancel order
- refund order
- pay order
- update payment
- update order status
- create audit logs
- enable alcohol module

## Manual SQL Checks

Run before and after opening `/client/orders` in Supabase mode.

Orders:

```sql
select
  id::text as order_id,
  client_id::text as client_id,
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

Client read mode must not:

- place order
- cancel order
- refund order
- pay order
- update payment
- update order status
- create audit logs
- enable alcohol module

## Issues Found

Code-level QA found no blocking issue after the Stage 16-3 wiring fix.

Manual Supabase QA is still required:

- confirm seeded order appears
- confirm seeded order `client_id`
- confirm no audit count change on page refresh
- confirm no order/payment/total changes
- confirm partner title behavior

## Final Decision

Code-level decision:

- Client orders read pilot is safe for manual Supabase TEST-project verification.
- Mock rollback remains available through `DATA_SOURCE_MODE=mock`.
- Do not add client writes until manual SQL verification is complete.

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- Alcohol sales and delivery remain disabled.
- Read mode does not touch `alcohol_module_settings`.
- AI cannot enable alcohol module.
- Client, partner, courier and admin cannot enable alcohol.

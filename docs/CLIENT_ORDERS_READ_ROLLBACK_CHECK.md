# Stage 16-5 - Client Orders Read Rollback Check

## Rollback Scope

This rollback check covers the Client Orders Supabase read pilot for `/client/orders`.

Current route note:

- `/dashboard/client` and `/dashboard/client/orders` do not exist in the current app.
- The selected existing client page is `/client/orders`.

Rollback must not add new reads, add writes, remove mock data, remove demo actions, protect routes, create login UI, change payments or enable the alcohol module.

## Current Safe State

Confirmed at code level:

- `DATA_SOURCE_MODE=mock` returns mock client order data through `getClientOrdersReadResult()`.
- `/client/orders` calls `getClientOrdersReadResult()`.
- `/client/orders` shows `Mock data mode`, `Supabase read pilot` and `Fallback to mock data` labels.
- `src/lib/data/client-orders-read.ts` has a mock fallback wrapper.
- `src/lib/data/client-orders-supabase.ts` filters Supabase reads by `client_id`.
- Existing client controls remain demo-only.

## Rollback Steps

Use this rollback path if Supabase read mode fails, returns unexpected data, or manual SQL checks do not match expectations.

1. Set local env:

```env
DATA_SOURCE_MODE=mock
ALCOHOL_MODULE_ENABLED=false
```

2. Restart the dev server.
3. Hard refresh the browser with `Ctrl+F5`.
4. Open `/client/orders`.
5. Confirm mock/demo client order data appears.
6. Confirm the `Mock data mode` label is visible.
7. Confirm demo controls remain demo-only.
8. Run:

```bash
npm run build
```

## Expected Rollback Behavior

After rollback to mock mode:

- `/client/orders` opens without Supabase env.
- Mock/demo client data appears.
- No raw Supabase, SQL or env errors are shown.
- No database changes are required.
- Demo actions remain available and demo-only.

## Database Safety

Read mode rollback should not require database changes.

Do not:

- delete audit logs
- reset schema
- change the test order
- change payment status
- change subtotal, delivery fee, discount or total
- cancel order
- refund order
- touch `alcohol_module_settings`

## Manual SQL Checks

Run before and after rollback if Supabase mode was tested.

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

Expected:

- no change caused by rollback

Audit count:

```sql
select count(*) as audit_count
from public.audit_logs;
```

Expected:

- no new audit record caused by rollback

Alcohol:

```sql
select *
from public.alcohol_module_settings;
```

Expected:

- `is_enabled = false`

## Error Handling

If Supabase read fails:

- UI falls back to mock data or shows safe message/code.
- UI must not expose raw errors.
- UI must not expose secrets.
- UI must not expose env values.

Allowed safe codes:

- `supabase_not_configured`
- `read_failed`
- `empty_result`
- `server_error`

## No-Write Confirmation

Client orders read mode and rollback must not:

- update `orders`
- insert `audit_logs`
- change order status
- change payment status
- change subtotal
- change delivery fee
- change discount
- change total
- place order
- cancel order
- refund order
- enable alcohol module

## Alcohol Confirmation

- `ALCOHOL_MODULE_ENABLED=false`
- Alcohol sales and delivery remain disabled.
- Rollback does not touch `alcohol_module_settings`.
- AI cannot enable alcohol module.
- Client, partner, courier and admin cannot enable alcohol module.

## Final Decision

Rollback path is safe at code level:

- one env change returns `/client/orders` to mock data
- no schema rollback is required
- no database cleanup is required for read-only page load
- build verification remains the final local check

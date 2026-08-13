# Stage 15-5 - Courier Deliveries Read Rollback Check

## Rollback Scope

This rollback check covers only the Courier Deliveries Supabase read pilot on `/courier/deliveries`.

Rollback must not add new reads, add writes, remove mock data, remove demo actions, protect routes, create login UI, change payments or enable the alcohol module.

## Current Safe State

Confirmed at code level:

- `DATA_SOURCE_MODE=mock` returns mock courier delivery data through `getCourierDeliveriesReadResult()`.
- `/courier/deliveries` does not require Supabase in mock mode.
- Existing courier controls remain demo-only.
- `DATA_SOURCE_MODE=supabase` activates only the controlled courier deliveries read pilot.
- Supabase adapter reads delivery-like records from `public.orders` with `method: "GET"`.
- Supabase read failure falls back to mock data with safe code/message.

## Rollback Steps

Use this rollback path if Supabase read mode fails, returns unexpected data, or manual SQL checks do not match expectations.

1. Set local env:

```env
DATA_SOURCE_MODE=mock
ALCOHOL_MODULE_ENABLED=false
```

2. Restart the dev server.
3. Hard refresh the browser with `Ctrl+F5`.
4. Open `/courier/deliveries`.
5. Confirm mock/demo courier delivery data appears.
6. Confirm the `Mock data mode` label is visible.
7. Confirm demo controls remain demo-only.
8. Run:

```bash
npm run build
```

## Expected Rollback Behavior

After rollback to mock mode:

- `/courier/deliveries` opens without Supabase env.
- Mock/demo courier delivery data appears.
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
- change totals
- assign courier
- mark picked up
- mark delivering
- mark delivered
- cancel or refund order
- report issue as a real write
- touch `alcohol_module_settings`

## Manual SQL Checks

Run before and after rollback if Supabase mode was tested.

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

Expected:

- no change caused by read mode rollback

Audit count:

```sql
select count(*) as audit_count
from public.audit_logs;
```

Expected:

- no new audit record caused by read mode rollback

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

Courier deliveries read mode and rollback must not:

- update `orders`
- insert `audit_logs`
- assign courier
- reassign courier
- mark picked up
- mark delivering
- mark delivered
- report issue as real write
- cancel order
- refund order
- update payment
- enable alcohol module

## Alcohol Confirmation

- `ALCOHOL_MODULE_ENABLED=false`
- Alcohol sales and delivery remain disabled.
- Rollback does not touch `alcohol_module_settings`.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol module.

## Final Decision

Rollback path is safe at code level:

- one env change returns `/courier/deliveries` to mock data
- no schema rollback is required
- no database cleanup is required for read-only page load
- build verification remains the final local check

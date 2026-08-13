# Stage 13-6 - Supabase Read Mode Rollback Check

## Rollback Scope

This rollback check covers the Supabase read mode pilot currently wired only for:

- `/partner/orders`
- `getPartnerOrdersReadResult()`
- `getPartnerOrdersFromSupabase(businessId?)`

This check does not add new reads, add writes, remove mock data, remove demo actions, protect routes, create login UI, change payments or enable alcohol module.

## Mock Mode Default

Confirmed in code:

- `DATA_SOURCE_MODE=mock` is the default safe mode.
- Invalid or missing `DATA_SOURCE_MODE` falls back to `mock`.
- `/partner/orders` uses mock/demo data when not in Supabase mode.
- No Supabase read is required in mock mode.
- Demo buttons remain rendered through `PartnerOrdersDemoActions`.

Expected mock behavior:

- `/partner/orders` opens.
- Label says `Mock data mode`.
- Mock/demo orders appear.
- Demo buttons remain available.
- The controlled real test button remains disabled unless `DATA_SOURCE_MODE=supabase`.

## Supabase Mode Control

Confirmed in code:

- `DATA_SOURCE_MODE=supabase` activates the controlled read pilot on `/partner/orders`.
- Supabase read is wrapped by safe fallback.
- If Supabase read fails, UI can show `Mock fallback`.
- Page load does not call the controlled real write form action.
- No new write action is added by read mode.

Supabase read mode must not:

- update order status
- update payment status
- change totals
- assign courier
- cancel order
- refund order
- mark delivered
- create audit logs
- enable alcohol module

## Rollback Steps

1. Set:

```env
DATA_SOURCE_MODE=mock
ALCOHOL_MODULE_ENABLED=false
```

2. Restart dev server.
3. Hard refresh browser with `Ctrl+F5`.
4. Open `/partner/orders`.
5. Confirm label says `Mock data mode`.
6. Confirm mock/demo orders appear.
7. Confirm demo buttons remain.
8. Run:

```bash
npm run build
```

## Database Safety

Read mode rollback should not require database changes.

Do not:

- delete audit logs
- reset schema
- delete seed data
- change test order status unless preparing for a later write test
- change payment status
- touch `alcohol_module_settings`

Audit logs should remain as evidence of manual write testing.

## Manual SQL Checks

Run before and after rollback if Supabase TEST project was used.

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

Expected:

- no change caused by read mode rollback
- `payment_status` unchanged
- `total` unchanged
- `updated_at` unchanged unless a separate write action was manually clicked

Alcohol check:

```sql
select *
from public.alcohol_module_settings;
```

Expected:

- `is_enabled = false`

## Error Handling

If Supabase read fails:

- UI should not crash.
- UI should fallback to mock or show safe message.
- UI should not show raw Supabase errors.
- UI should not show SQL details.
- UI should not expose service role key, auth token or private env values.

Allowed safe codes:

- `supabase_not_configured`
- `read_failed`
- `empty_result`
- `server_error`

## No-Write Confirmation

Read mode rollback and read mode page load must not:

- update `public.orders`
- insert into `public.audit_logs`
- mutate mock data
- run payment/refund/cancel logic
- run delivery completion logic
- touch `alcohol_module_settings`

The existing controlled real write pilot remains a separate explicit button and is not triggered by read mode itself.

## Final Decision

Rollback path is safe.

The safe rollback is a single environment mode change:

```env
DATA_SOURCE_MODE=mock
```

No schema reset, database mutation or code removal is required for the current read pilot.

## Recommended Next Stage

Recommended next stage:

- Stage 13-7 - Admin Delivery Supabase Read Adapter

Alternative:

- Stage 13-7 - Partner Orders Read Manual QA Completion

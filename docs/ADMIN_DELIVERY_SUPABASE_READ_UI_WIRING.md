# Stage 14-2 - Admin Delivery Supabase Read UI Wiring

## Scope

This stage wires `/admin/delivery` to the admin delivery read wrapper.

Changed files:

- `src/app/admin/delivery/page.tsx`
- `docs/ADMIN_DELIVERY_SUPABASE_READ_UI_WIRING.md`
- `README.md`

No public, partner, client, courier, action, database schema, payment, Telegram or n8n files were changed.

## Mode Behavior

### `DATA_SOURCE_MODE=mock`

- `/admin/delivery` uses mock admin delivery data from the wrapper.
- UI label: `Mock data mode`.
- Existing demo buttons remain demo-only.
- No Supabase read is required.

### `DATA_SOURCE_MODE=supabase`

- `/admin/delivery` calls the admin delivery Supabase read adapter through `getAdminDeliveryReadResult()`.
- UI label: `Supabase read pilot`.
- The page displays operational order fields from Supabase when read succeeds.

### Fallback

If Supabase read fails:

- wrapper returns mock data
- UI label: `Fallback to mock data`
- safe code is displayed when available
- no raw Supabase/SQL/env details are shown

Safe codes:

- `supabase_not_configured`
- `read_failed`
- `empty_result`
- `server_error`

## Displayed Fields

The admin delivery cards show:

- order id
- `business_id`
- partner title if available
- type
- status
- `payment_status`
- total
- `updated_at`

The schema uses `business_id`, not `partner_id`.

## No-Write Behavior

Opening `/admin/delivery` must not:

- update orders
- insert `audit_logs`
- assign courier
- reassign courier
- cancel orders
- refund orders
- update `payment_status`
- change total
- change delivery status
- touch `alcohol_module_settings`

Existing admin buttons remain demo-only and were not converted to real backend writes.

## Rollback

Rollback remains:

```env
DATA_SOURCE_MODE=mock
```

Then:

1. Restart dev server.
2. Hard refresh with `Ctrl+F5`.
3. Open `/admin/delivery`.
4. Confirm label says `Mock data mode`.
5. Confirm demo admin buttons remain visible.

No database schema change is required.

## Manual Test Steps

Mock mode:

1. Set `DATA_SOURCE_MODE=mock`.
2. Open `/admin/delivery`.
3. Confirm `Mock data mode`.
4. Confirm mock delivery/order cards appear.
5. Confirm demo buttons remain demo-only.

Supabase mode:

1. Set `DATA_SOURCE_MODE=supabase`.
2. Confirm Supabase TEST env values are local only.
3. Open `/admin/delivery`.
4. Confirm `Supabase read pilot` or safe fallback.
5. Confirm visible fields include order id, `business_id`, status, `payment_status`, total and `updated_at`.
6. Refresh the page and confirm no order/payment/audit/alcohol data changes.

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- UI wiring does not enable alcohol module.
- UI wiring does not touch `alcohol_module_settings`.
- Alcohol sales and delivery remain disabled.
- Partner, courier and admin cannot enable alcohol.
- AI cannot enable alcohol module.

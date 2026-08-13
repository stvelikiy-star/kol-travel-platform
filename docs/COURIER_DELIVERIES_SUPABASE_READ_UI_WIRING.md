# Stage 15-3 - Courier Deliveries Supabase Read UI Wiring

## Summary

`/courier/deliveries` now reads through the courier deliveries read wrapper.

This wiring is read-only. It does not add courier writes, courier assignment, pickup, delivery completion, real issue reporting, payment changes, cancellation, refunds, protected routes, login UI or alcohol module activation.

## Files Changed

- `src/app/courier/deliveries/page.tsx`
- `docs/COURIER_DELIVERIES_SUPABASE_READ_UI_WIRING.md`
- `README.md`

## Mode Behavior

`DATA_SOURCE_MODE=mock`:

- `/courier/deliveries` shows mock/demo courier delivery data.
- Supabase env is not required.
- Existing demo controls remain demo-only.

`DATA_SOURCE_MODE=supabase`:

- `/courier/deliveries` reads from the Supabase read adapter through `getCourierDeliveriesReadResult()`.
- The current source table is `public.orders`, mapped into delivery-like items.
- No write action is called on page load.

Supabase read failure:

- page falls back to mock data
- safe label/code/message is shown
- raw Supabase, SQL and env errors are not displayed

## UI Labels

The page shows a small safe mode label:

- `Mock data mode`
- `Supabase read pilot`
- `Fallback to mock data`

If available, the safe code is also displayed:

- `supabase_not_configured`
- `read_failed`
- `empty_result`
- `server_error`

## Displayed Fields

The page shows enough operational fields to verify the read source:

- delivery/order id
- `business_id`
- partner title if available
- type
- status
- payment status
- delivery fee
- total
- updated timestamp

## Source Table Used

The pilot reads delivery-like operational data from `public.orders`.

Schema note:

- use `orders.business_id`
- do not use `partner_id`

A future dedicated `deliveries` table may be introduced for courier assignment, route progress, issue flow and history.

## No-Write Behavior

Opening `/courier/deliveries` must not:

- update orders
- insert audit logs
- assign courier
- change status
- change payment status
- change total
- mark picked up
- mark delivering
- mark delivered
- report issue as a real write
- touch `alcohol_module_settings`

Existing courier buttons remain demo-only.

## Rollback Path

1. Set `DATA_SOURCE_MODE=mock`.
2. Keep `ALCOHOL_MODULE_ENABLED=false`.
3. Restart dev server.
4. Hard refresh with `Ctrl+F5`.
5. Open `/courier/deliveries`.
6. Confirm mock courier delivery data returns.
7. Run `npm run build`.

No schema rollback is required.

## Manual Test Steps

Mock mode:

1. Set `DATA_SOURCE_MODE=mock`.
2. Restart dev server.
3. Open `http://localhost:3000/courier/deliveries`.
4. Confirm `Mock data mode` and mock/demo deliveries.

Supabase mode:

1. Set `DATA_SOURCE_MODE=supabase`.
2. Restart dev server.
3. Open `http://localhost:3000/courier/deliveries`.
4. Confirm `Supabase read pilot` if read succeeds.
5. Confirm fallback label if Supabase read fails safely.

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- Alcohol sales and delivery remain disabled.
- Page does not touch `alcohol_module_settings`.
- Courier, partner and admin cannot enable alcohol.
- AI cannot enable alcohol.

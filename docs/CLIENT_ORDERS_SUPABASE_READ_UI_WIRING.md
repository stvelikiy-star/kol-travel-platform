# Stage 16-3 - Client Orders Supabase Read UI Wiring

## Summary

`/client/orders` now reads through the client orders read wrapper.

This wiring is read-only. It does not add client writes, payment actions, refund/cancel actions, order status changes, audit inserts, protected routes, login UI or alcohol module activation.

## Page Wired

Exact page:

- `src/app/client/orders/page.tsx`

Function used:

- `getClientOrdersReadResult()`

The page does not duplicate Supabase query logic. It reads through the data layer only.

## Mode Behavior

`DATA_SOURCE_MODE=mock`:

- `/client/orders` shows mock/demo client order data.
- Supabase env is not required.
- Existing client actions remain demo-only.

`DATA_SOURCE_MODE=supabase`:

- `/client/orders` reads from the Supabase read adapter through `getClientOrdersReadResult()`.
- The current source table is `public.orders`.
- The data layer filters by `client_id`.
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

- order id
- `client_id`
- `business_id`
- partner title if available
- type
- status
- payment status
- subtotal
- delivery fee
- discount
- total
- updated timestamp

## Source Table Used

The pilot reads client order data from `public.orders`.

Schema notes:

- use `client_id` for client filtering
- use `business_id`, not `partner_id`

Demo client id used by the data layer when no client id is provided:

- `00000000-0000-0000-0000-000000000002`

The read must not broaden to all production/private data.

## No-Write Behavior

Opening `/client/orders` must not:

- update orders
- insert audit logs
- change order status
- change payment status
- change subtotal
- change delivery fee
- change discount
- change total
- cancel order
- refund order
- touch `alcohol_module_settings`

Existing client buttons remain demo-only.

## Rollback Path

1. Set `DATA_SOURCE_MODE=mock`.
2. Keep `ALCOHOL_MODULE_ENABLED=false`.
3. Restart dev server.
4. Hard refresh with `Ctrl+F5`.
5. Open `/client/orders`.
6. Confirm mock client order data returns.
7. Run `npm run build`.

No schema rollback is required.

## Manual Test Steps

Mock mode:

1. Set `DATA_SOURCE_MODE=mock`.
2. Restart dev server.
3. Open `http://localhost:3000/client/orders`.
4. Confirm `Mock data mode` and mock/demo orders.

Supabase mode:

1. Set `DATA_SOURCE_MODE=supabase`.
2. Restart dev server.
3. Open `http://localhost:3000/client/orders`.
4. Confirm `Supabase read pilot` if read succeeds.
5. Confirm fallback label if Supabase read fails safely.

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- Alcohol sales and delivery remain disabled.
- Page does not touch `alcohol_module_settings`.
- Client, partner, courier and admin cannot enable alcohol.
- AI cannot enable alcohol.

# Stage 17-4 - Public Catalog Supabase Read UI Pilot

## Selected Page Wired

Selected public page:

- `/food`

Exact file:

- `src/app/food/page.tsx`

Wrapper used:

- `getPublicFoodReadResult()`

The page does not duplicate Supabase query logic. It reads through the public catalog data wrapper only.

## Mode Behavior

`DATA_SOURCE_MODE=mock`:

- `/food` shows existing mock/static food catalog data.
- Supabase env is not required.
- Existing CTA buttons remain safe demo/navigation behavior.

`DATA_SOURCE_MODE=supabase`:

- `/food` uses the controlled Supabase read pilot for `public.menu_items`.
- If the read succeeds, the page shows `Supabase read pilot`.
- If the read fails or the table is unavailable, the page falls back to mock data.

Fallback:

- safe label/message is shown
- no raw Supabase, SQL or env errors are displayed
- public catalog remains usable

## UI Label Behavior

The page shows a small pilot label above the catalog:

- `Mock data mode`
- `Supabase read pilot`
- `Fallback to mock data`

If available, the safe code is also displayed:

- `supabase_not_configured`
- `table_missing`
- `read_failed`
- `empty_result`
- `server_error`

## Layout Preservation

The existing `/food` layout is preserved:

- `PublicHeader`
- `CatalogSection`
- `CatalogToolbar`
- `FoodCard` grid
- `PublicFooter`

Only a small internal read-mode label card was added.

## Source Table

Source table for pilot:

- `public.menu_items`

Optional joins:

- `categories(title)`
- `partners(title,slug)`

The app still falls back to mock food data if Supabase read mode fails.

## No-Write Behavior

Opening `/food` must not:

- create order
- create booking
- create cart
- create checkout
- update availability
- update prices
- insert audit logs
- touch `alcohol_module_settings`

Existing CTA buttons were not converted into real writes.

## Rollback Path

1. Set `DATA_SOURCE_MODE=mock`.
2. Keep `ALCOHOL_MODULE_ENABLED=false`.
3. Restart dev server.
4. Open `/food`.
5. Confirm mock food catalog data returns.
6. Run `npm run build`.

No schema rollback is required.

## Manual Test Steps

Mock mode:

1. Set `DATA_SOURCE_MODE=mock`.
2. Restart dev server.
3. Open `http://localhost:3000/food`.
4. Confirm `Mock data mode` and mock food cards.

Supabase mode:

1. Set `DATA_SOURCE_MODE=supabase`.
2. Restart dev server.
3. Open `http://localhost:3000/food`.
4. Confirm `Supabase read pilot` if read succeeds.
5. Confirm fallback label if Supabase read fails safely.

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- Alcohol category/items must not be shown.
- Page does not touch `alcohol_module_settings`.
- Food/shop alcohol sales and delivery remain disabled.

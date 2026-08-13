# Stage 17-3 - Public Catalog Read Adapter

## Selected Pilot

Selected safe pilot:

- `/food`

Source table:

- `public.menu_items`

Related tables:

- `public.categories` for category title
- `public.partners` for future partner title/slug display

## Files Created Or Updated

- `src/lib/data/public-catalog-supabase.ts`
- `src/lib/data/public-catalog-read.ts`
- `src/lib/data/types.ts`
- `docs/PUBLIC_CATALOG_READ_ADAPTER.md`
- `README.md`

## Adapter Decision

Decision:

- real read-only adapter, not table-missing stub

Reason:

- `menu_items` table exists in `001_initial_schema.sql`
- seed data includes active demo menu item
- `categories` and `partners` exist
- mock fallback is available

If the TEST Supabase project does not match local SQL or relationship joins fail, the adapter returns safe error codes and the wrapper falls back to mock data.

## Fields Used

Read from `menu_items`:

- `id`
- `business_id`
- `title`
- `description`
- `price`
- `status`

Optional joins:

- `categories(title)`
- `partners(title,slug)`

Mapped app fields:

- `id`
- `businessId`
- `category`
- `title`
- `description`
- `price`
- `currency = KGS`
- `status`

## Mode Behavior

`getPublicFoodReadResult()` behavior:

- `DATA_SOURCE_MODE=mock`: returns existing `getMockFood()` data
- `DATA_SOURCE_MODE=supabase`: calls `getPublicFoodFromSupabase()`
- Supabase read failure/table missing/empty: returns mock fallback with safe code/message

Safe result shape:

```ts
{
  ok: boolean,
  source: "mock" | "supabase" | "fallback",
  items: [],
  code?: string,
  message?: string
}
```

## Safe Errors

Allowed safe codes:

- `supabase_not_configured`
- `table_missing`
- `read_failed`
- `empty_result`
- `server_error`

Never expose:

- raw Supabase errors
- SQL details
- service role key
- auth token
- private env values

## No-Write Guarantee

This adapter must not:

- create orders
- create bookings
- update availability
- change prices
- insert audit logs
- create cart
- create checkout
- touch `alcohol_module_settings`

The Supabase request uses `method: "GET"`.

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- Adapter filters to active menu items only.
- Adapter must not return alcohol items/categories.
- Adapter does not touch `alcohol_module_settings`.
- Alcohol sales and delivery remain disabled.

## Rollback Path

1. Set `DATA_SOURCE_MODE=mock`.
2. Keep `ALCOHOL_MODULE_ENABLED=false`.
3. Restart dev server.
4. Open `/food`.
5. Confirm mock food catalog returns.
6. Run `npm run build`.

No schema rollback is required for read adapter failures.

## Limitations

- UI is not wired in this stage.
- Detail route `/food/[restaurantSlug]` is not wired in this stage.
- Partner title/slug join depends on Supabase relationship metadata.
- Image/media mapping is not included yet.
- Manual Supabase QA is required before public UI wiring.

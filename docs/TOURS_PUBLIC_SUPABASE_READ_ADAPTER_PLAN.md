# Stage 22-1 - Tours Public Supabase Read Adapter Plan, Without Migration

## Purpose

Plan expansion of public Supabase read mode from `/food` to `/tours` without applying any migration.

This plan protects the current working project:

- `/food` read pilot remains unchanged
- existing `tours` table is used as-is
- mock fallback remains available
- `DATA_SOURCE_MODE=mock` remains the safe default
- no SQL is applied
- no schema files are modified
- no writes are added
- `ALCOHOL_MODULE_ENABLED=false`

## Current Verified State

Stage 20 verified the real Supabase schema.

Stage 21 created a minimal additive SQL draft only:

- draft SQL has not been applied
- no DB changes have been made
- no adapters/UI/writes were added

Verified catalog tables include:

- `categories`
- `partners`
- `tours`
- `stays`
- `menu_items`
- `products`
- `restaurants`
- `shops`

`/tours` is likely ready for a read adapter using the current table fields.

## Verified tours Table Fields

Current `public.tours` fields:

- `id`
- `business_id`
- `category_id`
- `title`
- `slug`
- `description`
- `location`
- `price`
- `currency`
- `duration`
- `status`
- `metadata`
- `created_at`
- `updated_at`

Verified relations:

- `tours.business_id -> partners.id`
- `tours.category_id -> categories.id`

## Data Source Strategy

Use the same read-mode pattern as `/food`:

- `DATA_SOURCE_MODE=mock`: return existing mock tours
- `DATA_SOURCE_MODE=supabase`: call a controlled Supabase tours adapter
- Supabase failure: fallback to mock
- public page must not crash
- no raw Supabase, SQL, auth or env errors shown to users
- no writes on page load

Mode labels for later UI wiring:

- `Mock data mode`
- `Supabase read pilot`
- `Fallback to mock data`

## Proposed Files For Later Implementation

Do not create these files in Stage 22-1. Plan only:

- `src/lib/data/public-tours-supabase.ts`
- `src/lib/data/public-tours-read.ts`
- possible update to `src/app/tours/page.tsx`

The later implementation should mirror the `/food` read wrapper shape, without over-building a shared abstraction too early.

## Proposed Read Query

Base table:

- `public.tours`

Safe fields:

- `id`
- `business_id`
- `category_id`
- `title`
- `slug`
- `description`
- `location`
- `price`
- `currency`
- `duration`
- `status`
- `metadata`
- `created_at`
- `updated_at`

Optional joins if supported in the Supabase REST relationship metadata:

- `categories(title, slug, scope)`
- `partners(title, slug, type, status, business_status, rating)`

If joins are not available, keep `business_id` and `category_id` and use mock/default labels where needed.

## Filtering

Only public-safe items should be shown.

Preferred filter:

- `status = active`

If the seeded `tours.status` uses another public value, document the current value before changing adapter filters.

Rules:

- do not show inactive/private data if identifiable
- do not loosen filtering for production
- keep fallback to mock if safe filtering cannot be confirmed

## Mapping

Map Supabase tour rows to the current `/tours` UI shape.

Suggested mapping:

- `id -> id`
- `slug -> slug`
- `title -> title`
- `description -> description`
- `location -> location`
- `price -> price/priceFrom equivalent`
- `currency -> currency`
- `duration -> duration/durationLabel equivalent`
- `status -> status`
- category join title or fallback category label
- partner join title/slug or fallback partner label

Because `image_url` is not available yet:

- use existing mock/default image fallback
- do not require `image_url`
- do not apply migration only for images

## Result States

The adapter/read wrapper should support:

- `mock_mode`
- `supabase_success`
- `table_missing`
- `read_failed`
- `empty_result`
- `server_error`
- `fallback_to_mock`

Recommended safe result shape:

```ts
{
  ok: boolean
  source: "mock" | "supabase" | "fallback"
  items: Tour[]
  code?: "supabase_not_configured" | "table_missing" | "read_failed" | "empty_result" | "server_error"
  message?: string
}
```

## No-Write Guarantee

The future tours read adapter must not:

- create booking
- update availability
- create cart
- create checkout
- create payment
- insert `audit_logs`
- update `tours`
- update `partners`
- update `categories`
- update `orders`

It must be read-only.

## Alcohol

- `ALCOHOL_MODULE_ENABLED=false`
- tours read mode must not touch alcohol module
- no alcohol sales/delivery
- no alcohol settings changed
- no alcohol category/item work in this stage

## QA Plan For Later Implementation

Later implementation should test:

- `DATA_SOURCE_MODE=mock`
- `DATA_SOURCE_MODE=supabase`
- missing table fallback
- read failure fallback
- empty result fallback
- build
- no writes on page load
- no `audit_logs` insert from reads
- `ALCOHOL_MODULE_ENABLED=false`
- `alcohol_module_settings` unchanged

Manual Supabase checks should verify:

- tour seed status value
- public-safe status filter
- category join
- partner join
- row count before/after page load unchanged

## Rollback

Rollback remains simple:

1. Set `DATA_SOURCE_MODE=mock`.
2. Restart dev server.
3. `/tours` returns to current mock data.
4. No schema rollback is required because no migration is applied.

## Recommended Next Stages

1. 22-2 Create tours Supabase read adapter
2. 22-3 Wire `/tours` page to read result
3. 22-4 Tours read QA
4. 22-5 Stage 22 final audit

## Final Plan Decision

Proceed to Stage 22-2 with a read-only tours Supabase adapter.

Do not apply the Stage 21 draft SQL before the tours read adapter unless a separate approval path says image/SEO fields are required first.

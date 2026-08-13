# Stage 18-4 - Food Schema Alignment Audit

## Scope

This audit checks the current `/food` Supabase read pilot against the future public catalog schema plan.

This stage is inspection/documentation only. It does not change schema, create migrations, implement adapters, wire UI, add writes, change payments or enable the alcohol module.

## Current /food Adapter

Current files:

- `src/lib/data/public-catalog-supabase.ts`
- `src/lib/data/public-catalog-read.ts`
- `src/app/food/page.tsx`

Current Supabase adapter:

- table: `public.menu_items`
- method: `GET`
- selected fields:
  - `id`
  - `business_id`
  - `title`
  - `description`
  - `price`
  - `status`
  - `categories(title)`
  - `partners(title,slug)`
- filter:
  - `status = active`
- ordering:
  - `created_at.desc`
- safe error paths:
  - `supabase_not_configured`
  - `table_missing`
  - `read_failed`
  - `empty_result`
  - `server_error`
- fallback:
  - `getPublicFoodReadResult()` returns `getMockFood()` when `DATA_SOURCE_MODE=mock`
  - Supabase failures return fallback mock food with safe message/code

The adapter maps rows into the existing `FoodItem` shape and keeps `currency = KGS` in code.

## Current menu_items Schema

From `supabase/schema/001_initial_schema.sql`, `public.menu_items` currently includes:

- `id uuid primary key default gen_random_uuid()`
- `business_id uuid not null references public.partners(id) on delete cascade`
- `category_id uuid references public.categories(id) on delete set null`
- `title text not null`
- `description text`
- `price numeric(12,2) not null default 0`
- `preparation_time_minutes integer`
- `status text not null default 'under_review'`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Current RLS draft includes:

- public can select menu items where `status = 'active'`
- partner can manage own `business_id`
- admin can read/manage according to helper policies

Current fixed seed includes one active demo menu item:

- `43000000-0000-0000-0000-000000000001`
- `business_id = 20000000-0000-0000-0000-000000000001`
- title: `Demo beshbarmak`
- status: `active`

## Future Recommended menu_items Schema

Future recommended fields:

- `id`
- `business_id`
- `category_id`
- `title`
- `slug`
- `description`
- `price`
- `currency`
- `image_url`
- `is_available`
- `is_featured`
- `status`
- `metadata`
- `seo_title`
- `seo_description`
- `created_at`
- `updated_at`

Recommendation:

- keep `menu_items` as the canonical food item table
- align it with additive nullable/defaulted fields later
- do not create a duplicate food item table
- do not rename `menu_items` while `/food` depends on it

## Gap Analysis

| Field | Current availability | Future need | Risk | Migration note |
| --- | --- | --- | --- | --- |
| `id` | Available | Required | Low | Already aligned. |
| `business_id` | Available, references `partners(id)` | Required | Low | Keep as ownership field. |
| `category_id` | Available, references `categories(id)` | Required | Medium | Current `categories.scope` should be aligned with future domain model. |
| `title` | Available | Required | Low | Already aligned. |
| `slug` | Missing | Required for detail/SEO routes | Medium | Add nullable first, backfill, then consider unique per business. |
| `description` | Available | Required | Low | Already aligned. |
| `price` | Available | Required | Low | Already aligned. |
| `currency` | Missing; adapter hardcodes `KGS` | Required | Low | Add default `KGS`. |
| `image_url` | Missing | Useful for public cards | Medium | Add `image_url` or use `catalog_images`. |
| `is_available` | Missing | Needed for public availability filter | Medium | Add default `true`; public read can filter `status='active'` and `is_available=true`. |
| `is_featured` | Missing | Useful for featured catalog | Low | Add default `false`. |
| `status` | Available | Required | Medium | Current values include `under_review` and `active`; future status enum/check should be consistent. |
| `metadata` | Available | Required | Low | Already aligned. |
| `seo_title` | Missing | Needed for SEO | Low | Add nullable. |
| `seo_description` | Missing | Needed for SEO | Low | Add nullable. |
| `created_at` | Available | Required | Low | Already aligned. |
| `updated_at` | Available | Required | Low | Already aligned. |
| `preparation_time_minutes` | Available | Food-specific useful field | Low | Keep; not part of shared catalog minimum. |

## Categories Audit

Current `public.categories` includes:

- `id`
- `scope`
- `title`
- `slug`
- `parent_id`
- `sort_order`
- `created_at`
- `updated_at`
- unique `(scope, slug)`

Future `catalog_categories` plan uses:

- `domain: tour | stay | food | shop`
- `is_active`
- optional description

Alignment decision:

- current `categories.scope` can likely serve the same purpose as future `domain`
- before creating `catalog_categories`, decide whether to rename/extend current `categories` or keep it as canonical
- avoid duplicate category tables unless there is a strong migration reason

Current gap:

- no `is_active`
- no `description`
- domain naming uses `scope`, not `domain`

## Partners Relationship

Food items correctly use:

- `business_id = partners.id`

Do not introduce `partner_id` for food/menu ownership.

Partner profile/ownership checks later should resolve partner access through `business_id`.

## Public Filtering

Current adapter filters:

- `status = active`

Future public filter should be:

- `status = active`
- `is_available = true` when `is_available` exists

Current limitation:

- `is_available` does not exist yet, so the adapter cannot filter unavailable active items separately from status.

## SEO Audit

Current `menu_items` does not include:

- `slug`
- `seo_title`
- `seo_description`

Future need:

- add SEO fields for detail pages and improved public catalog metadata
- backfill demo-safe slugs before wiring food detail reads from Supabase

## Images Audit

Current `menu_items` does not include:

- `image_url`

Current adapter does not read images.

Future options:

- add `image_url` directly for simple catalog cards
- add shared `catalog_images`
- add `menu_item_images`

Recommendation:

- for first alignment, add simple `image_url` or document fallback image behavior
- use shared `catalog_images` later if media management becomes cross-domain

## No-Write Guarantee

This audit added no writes and changed no code/schema.

It did not:

- update `menu_items`
- insert `audit_logs`
- create orders/bookings/cart/checkout
- change payment data
- touch `alcohol_module_settings`

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- no alcohol categories/items should be seeded
- current food seed contains no alcohol item
- food schema must support excluding alcohol-like categories/items
- `alcohol_module_settings` is untouched
- AI, client, partner, courier and admin cannot enable alcohol

## Recommended Next Steps

Current `menu_items` is close enough for the first `/food` read pilot.

Recommended future alignment migration:

1. Add nullable/defaulted `slug`, `currency`, `image_url`, `is_available`, `is_featured`, `seo_title`, `seo_description`.
2. Decide whether current `categories.scope` remains canonical or is migrated toward `domain`.
3. Backfill demo-safe slugs and currency.
4. Update read adapter to include new fields only after migration is verified.
5. Keep mock fallback and no-write public reads throughout.

Do not apply migration in Stage 18.

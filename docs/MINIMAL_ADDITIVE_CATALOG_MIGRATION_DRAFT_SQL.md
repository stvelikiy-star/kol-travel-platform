# Stage 21-2 - Minimal Additive Catalog Migration Draft SQL

## Draft File

- `supabase/schema/004_minimal_additive_catalog_fields_DRAFT_NOT_APPLIED.sql`

Status:

- DRAFT ONLY
- NOT APPLIED
- FOR REVIEW ONLY
- apply only after manual approval and backup

No Supabase SQL was run during this stage.

## Fields Included

`menu_items`:

- `slug`
- `currency`
- `image_url`
- `is_available`
- `is_featured`
- `seo_title`
- `seo_description`

`products`:

- `slug`
- `currency`
- `image_url`
- `is_featured`
- `seo_title`
- `seo_description`

`tours`:

- `image_url`
- `is_featured`
- `seo_title`
- `seo_description`

`stays`:

- `image_url`
- `capacity`
- `amenities`
- `is_featured`
- `seo_title`
- `seo_description`

`categories`:

- `is_active`

`categories.is_active` is included as an optional additive category visibility field because `categories` already exists and no `catalog_categories` table should be created.

## Indexes Proposed

Non-unique indexes only:

- `menu_items(slug)`
- `menu_items(business_id)`
- `menu_items(category_id)`
- `menu_items(status)`
- `menu_items(is_available)`
- `menu_items(is_featured)`
- `products(slug)`
- `products(business_id)`
- `products(category_id)`
- `products(status)`
- `tours(slug)`
- `tours(status)`
- `tours(is_featured)`
- `stays(slug)`
- `stays(status)`
- `stays(is_featured)`
- `categories(scope)`
- `categories(slug)`
- `categories(is_active)`

No unique slug constraints are included.

## Intentionally Not Included

This draft intentionally excludes:

- base table creation
- duplicate `catalog_categories`
- duplicate `shop_products`
- duplicate `menu_items`, `products`, `tours`, `stays`, `restaurants` or `shops`
- `partner_id`
- RLS policy changes
- seed data
- cart/checkout/payment/order/booking logic
- app actions
- UI wiring
- alcohol settings or alcohol catalog data

## /food Protection

The draft does not change existing `menu_items` fields used by `/food`:

- `id`
- `business_id`
- `category_id`
- `title`
- `description`
- `price`
- `preparation_time_minutes`
- `status`
- `metadata`
- `created_at`
- `updated_at`

The current `/food` adapter can continue reading `public.menu_items`.

## Rollback Notes

Because this is additive, rollback should usually be unnecessary.

If a future test apply causes read issues:

1. Set `DATA_SOURCE_MODE=mock`.
2. Keep mock fallback active.
3. Do not remove columns immediately.
4. Investigate in the test project.
5. Use manual rollback only in the test project after explicit approval.

## Review Checklist

Before any future apply:

- confirm this is the test Supabase project
- export/backup data
- confirm `/food` works before apply
- confirm alcohol module is disabled
- confirm no unsafe SQL is present
- confirm no unique constraints are forced
- confirm no RLS or seed changes are included
- receive explicit user approval

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- `alcohol_module_settings` is untouched
- no alcohol categories/items
- no alcohol sales/delivery
- no alcohol activation path

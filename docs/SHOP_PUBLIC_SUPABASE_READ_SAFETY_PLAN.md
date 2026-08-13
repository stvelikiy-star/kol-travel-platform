# Stage 24-1 - Shop Public Supabase Read Safety Plan, Without Migration

Project: KOL / Issyk-Kul Travel & Delivery Platform

## Purpose

This stage prepares safe `/shop` read-mode expansion without migration.

Shop products require extra caution because products may include sensitive or regulated goods. The first public Supabase shop read pilot must prevent alcohol/product risk, avoid cart/checkout/payment/order writes, keep mock fallback, and avoid schema changes.

## Current Schema

Verified `products` fields:

- `id`
- `business_id`
- `category_id`
- `title`
- `description`
- `price`
- `stock_qty`
- `status`
- `metadata`
- `created_at`
- `updated_at`

Verified `shops` fields:

- `id`
- `business_id`
- `delivery_enabled`
- `working_hours`
- `created_at`
- `updated_at`

Relevant `partners` fields:

- `id`
- `title`
- `slug`
- `type`
- `status`
- `business_status`
- `rating`

Relevant `categories` fields:

- `id`
- `scope`
- `title`
- `slug`
- `parent_id`
- `sort_order`

## Product / Alcohol Safety

Strict rules:

- `ALCOHOL_MODULE_ENABLED=false`
- do not query `alcohol_module_settings` except read-only audit if a later stage explicitly asks
- do not show alcohol products
- do not show alcohol categories
- do not infer alcohol sales from metadata as allowed
- if product/category metadata indicates alcohol, exclude it
- if category title/slug clearly indicates alcohol, exclude it
- if product title/description clearly indicates alcohol, exclude it
- when uncertain, exclude product from the public shop read pilot

The first adapter should use conservative keyword filtering as a temporary guard. This is not final legal/compliance logic.

## Safe Product Filtering

Planned filters:

- product status should be `active` or `published` if available
- partner status/business status should be public-safe when available
- shop delivery state can be added later if the relationship is safe and the page requires delivery semantics
- exclude private, inactive, draft, hidden, or clearly unsafe items
- exclude alcohol-related titles, slugs, categories, and metadata

## No-Write Guarantee

The future `/shop` read adapter must not:

- create cart
- create checkout
- create order
- create payment
- update stock
- update products
- update shops
- update partners
- update categories
- insert `audit_logs`

## Missing Fields

`products` currently lacks:

- `slug`
- `currency`
- `image_url`
- `is_featured`
- `seo_title`
- `seo_description`

Plan:

- do not require these fields for the basic read pilot
- use default/mock image fallback
- use `KGS` as display fallback when currency is missing
- do not apply migration just for `/shop` read pilot

## Proposed Future Files

Created in the next implementation stage:

- `src/lib/data/public-shop-supabase.ts`
- `src/lib/data/public-shop-read.ts`
- possible update to `src/app/shop/page.tsx`

## Proposed Read Query

Use `public.products` as the base table.

Select:

- `id`
- `business_id`
- `category_id`
- `title`
- `description`
- `price`
- `stock_qty`
- `status`
- `metadata`
- `created_at`
- `updated_at`

Optional joins:

- `categories(title, slug, scope)`
- `partners(title, slug, type, status, business_status, rating)`
- `shops(delivery_enabled, working_hours)` only if the relationship is safe

## Fallback States

Future adapter/read wrapper should support:

- `mock_mode`
- `supabase_success`
- `table_missing`
- `read_failed`
- `empty_result`
- `server_error`
- `fallback_to_mock`
- `safety_filtered`

## Labels

Future `/shop` page should show:

- `Mock data mode`
- `Supabase read pilot`
- `Fallback to mock data`
- `Safety filtered` if relevant

## QA Plan

Future QA must verify:

- mock mode
- Supabase mode
- fallback mode
- no writes
- no cart/checkout/payment/order creation
- `ALCOHOL_MODULE_ENABLED=false`
- alcohol products excluded
- build passes

## Stage Recommendation

Recommended next stages:

- Stage 24-2 - Create Shop Public Supabase Read Adapter, Without UI Wiring
- Stage 24-3 - Wire `/shop` page
- Stage 24-4 - Shop read QA
- Stage 24-5 - Shop final audit

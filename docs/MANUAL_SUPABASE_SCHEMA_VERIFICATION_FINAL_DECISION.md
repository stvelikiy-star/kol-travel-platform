# Stage 20-3 - Manual Supabase Schema Verification Final Decision

## Final Decision

Manual verification confirms it is not safe or necessary to create a full new catalog schema.

Correct path:

- keep existing tables
- avoid duplicates
- use minimal additive migration later
- protect current `/food` adapter
- continue read-mode expansion safely
- keep `DATA_SOURCE_MODE=mock` as rollback
- keep `ALCOHOL_MODULE_ENABLED=false`

No SQL migration files, schema changes, adapters, UI wiring, writes, payments, bookings, carts, checkout or alcohol changes are part of this stage.

## Confirmed Existing Base Tables

Confirmed base tables:

- `categories`
- `partners`
- `menu_items`
- `products`
- `restaurants`
- `shops`
- `stays`
- `tours`

Supporting operational/compliance tables:

- `orders`
- `audit_logs`
- `alcohol_module_settings`

## Confirmed Architecture

Confirmed relationship model:

- `business_id = partners.id`
- no `partner_id`
- `categories.id` is used by `category_id`
- `categories.parent_id` supports hierarchy
- `categories.scope` supports domain separation

This architecture should be preserved.

## What Not To Create

Do not create duplicate:

- `catalog_categories`
- `shop_products`
- `restaurants`
- `shops`
- `tours`
- `stays`
- `menu_items`
- `products`

Only create a separate table in the future if manual verification proves the existing table cannot safely support the domain.

## Safe Future Migration Type

Only additive fields:

- no rename
- no drop
- no destructive changes
- no data deletion
- no adapter-breaking changes
- no removal of mock fallback
- no write enablement by default

## Highest Priority Additive Fields

### menu_items

- `slug`
- `currency`
- `image_url`
- `is_available`
- `is_featured`
- `seo_title`
- `seo_description`

### products

- `slug`
- `currency`
- `image_url`
- `is_featured`
- `seo_title`
- `seo_description`

### tours

- `image_url`
- `is_featured`
- `seo_title`
- `seo_description`

### stays

- `image_url`
- `capacity`
- `amenities`
- `is_featured`
- `seo_title`
- `seo_description`

## Read-Mode Next Steps

Recommended safe options after Stage 20:

1. Stage 21 - Minimal Additive Catalog Migration Draft
2. Stage 21 - Tours Public Supabase Read Adapter

Decision guidance:

- choose migration draft first if image/SEO/availability fields are required before adapter expansion
- choose tours read adapter first if current `tours` fields already support the UI

Final recommendation:

- proceed to Stage 21 with a minimal additive migration draft first
- do not apply SQL yet

## Alcohol

- `ALCOHOL_MODULE_ENABLED=false`
- no alcohol category/items
- no alcohol settings changed
- no public alcohol sales/delivery
- food/menu drinks must remain non-alcohol only
- shop/products must not include alcohol
- AI cannot enable alcohol
- client, partner, courier and admin cannot enable alcohol

## Remaining Risks

- RLS verification still needs deeper review before production
- seed data is minimal
- image/SEO fields are missing
- write flows are not ready
- availability/pricing is not ready
- `/shop` read expansion needs explicit alcohol exclusion
- public adapters must continue to hide raw Supabase/SQL/env errors

## Final Recommendation

Proceed to Stage 21 with a minimal additive migration draft only.

Do not apply SQL yet.

Do not create duplicate tables.

Do not alter the working `/food` adapter without a separate adapter QA stage.

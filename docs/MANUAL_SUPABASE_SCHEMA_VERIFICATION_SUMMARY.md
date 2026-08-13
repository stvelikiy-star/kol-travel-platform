# Stage 20-1 - Manual Supabase Schema Verification Summary

## Summary

Manual Supabase SQL verification confirms the existing schema is stronger than expected.

The project should not create duplicate base catalog tables. Future migration work should be minimal and additive only.

## Verified Tables

Confirmed existing public tables:

- `alcohol_module_settings`
- `audit_logs`
- `categories`
- `menu_items`
- `orders`
- `partners`
- `products`
- `restaurants`
- `shops`
- `stays`
- `tours`

## Row Counts

| Table | Row count |
| --- | ---: |
| `categories` | 3 |
| `tours` | 1 |
| `stays` | 1 |
| `restaurants` | 1 |
| `menu_items` | 1 |
| `shops` | 1 |
| `products` | 1 |
| `partners` | 1 |

Row counts for `orders`, `audit_logs` and `alcohol_module_settings` were not provided in the pasted results, except that `alcohol_module_settings` exists and is disabled.

## Confirmed Foreign Keys

- `categories.parent_id -> categories.id`
- `menu_items.business_id -> partners.id`
- `menu_items.category_id -> categories.id`
- `orders.business_id -> partners.id`
- `products.business_id -> partners.id`
- `products.category_id -> categories.id`
- `restaurants.business_id -> partners.id`
- `shops.business_id -> partners.id`
- `stays.business_id -> partners.id`
- `stays.category_id -> categories.id`
- `tours.business_id -> partners.id`
- `tours.category_id -> categories.id`

Relationship decision:

- keep `business_id = partners.id`
- do not introduce `partner_id`

## Major Schema Strengths

- Base catalog tables already exist for tours, stays, food, shops and products.
- `categories` already exists and supports scoped taxonomy.
- `partners` already has public business fields such as title, slug, type, location, rating and status.
- Food `/menu_items` already supports the current `/food` read pilot.
- Business ownership is consistently represented by `business_id`.
- Seed data exists for each public catalog domain.
- Alcohol settings exist and remain disabled.

## Missing Future Fields

Recommended additive fields later.

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

## Migration Recommendation

Do not create base catalog tables.

Do not create:

- duplicate `catalog_categories`
- duplicate `shop_products` while `products` exists
- duplicate food item table while `menu_items` works
- duplicate partner ownership fields such as `partner_id`

Recommended future migration:

- minimal additive-only migration
- no column drops
- no column renames
- preserve current `/food` adapter columns
- preserve mock fallback
- add only verified missing fields

## /food Adapter Decision

Current `/food` adapter should remain protected.

It depends on:

- `public.menu_items`
- `id`
- `business_id`
- `title`
- `description`
- `price`
- `status`
- `categories(title)`
- `partners(title, slug)`
- `created_at`

No base-table migration is required for the current `/food` pilot.

## Alcohol Status

- `alcohol_module_settings` exists.
- `is_enabled=false`.
- Alcohol module remains disabled.
- `alcohol_module_settings` was not changed.
- No alcohol categories/items should be created.
- No alcohol sales/delivery should be enabled.

## Final Decision

Stage 20-1 confirms manual schema verification results are sufficient to move from broad schema planning to minimal additive migration planning.

Final decision:

- existing base catalog schema should be preserved
- future migration should be minimal and additive
- no duplicate tables should be created
- `/food` adapter remains safe and should not be broken

## Recommended Next Stage

Recommended next stage:

- Stage 20-2 - Minimal Additive Catalog Migration Draft Plan

This should still be a plan first. Do not create SQL migration files until the exact additive field list is reviewed.

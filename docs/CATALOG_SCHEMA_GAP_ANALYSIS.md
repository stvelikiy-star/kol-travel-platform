# Stage 20-2 - Catalog Schema Gap Analysis

## Summary

Manual Supabase verification confirms the existing catalog schema is already usable.

Key decisions:

- do not duplicate base catalog tables
- use minimal additive migration only after approval
- protect the current `/food` adapter
- keep `business_id = partners.id` as the canonical business relationship
- keep mock fallback available
- keep `ALCOHOL_MODULE_ENABLED=false`

No schema changes, SQL migrations, adapters, UI wiring, writes, payment, booking, cart, checkout or alcohol changes are part of this stage.

## Categories

Current fields:

- `id`
- `scope`
- `title`
- `slug`
- `parent_id`
- `sort_order`
- `created_at`
- `updated_at`

Current strengths:

- existing table already supports scoped taxonomy
- `parent_id` supports category hierarchy
- `title` supports current joins
- `slug` and `sort_order` already exist

Current missing fields:

- `is_active`
- optional `description`

Read adapter/page readiness:

- categories are already usable for joins such as `categories(title)`

Migration required now:

- No.

Recommended additive fields later:

- `is_active` only if active/inactive category visibility is needed
- `description` only if category landing pages need copy

Risk level:

- Low.

Conclusion:

- no `catalog_categories` table is needed
- keep existing `categories`

## Partners

Current fields include:

- `id`
- `owner_user_id`
- `type`
- `title`
- `slug`
- `description`
- `location`
- `address`
- `phone`
- `email`
- `status`
- `business_status`
- `rating`
- `metadata`
- `created_at`
- `updated_at`

Current strengths:

- strong business source table
- supports public title/slug joins
- supports business type and status
- supports public rating/location fields

Current missing fields:

- none blocking for catalog read planning

Read adapter/page readiness:

- usable as partner/business source for all public catalog domains

Migration required now:

- No.

Recommended additive fields later:

- none until a concrete public/business requirement appears

Risk level:

- Low.

Conclusion:

- `partners` is strong enough as business source
- keep `business_id = partners.id`
- do not introduce `partner_id`

## Food / menu_items

Current strengths:

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

Current missing fields:

- `slug`
- `currency`
- `image_url`
- `is_available`
- `is_featured`
- `seo_title`
- `seo_description`

Read adapter/page readiness:

- current `/food` read pilot can continue
- current adapter reads `public.menu_items`
- current adapter uses `status = active`
- current adapter uses `categories(title)` and `partners(title, slug)` joins
- mock fallback remains available

Migration required now:

- No, not for the current `/food` pilot.

Recommended additive fields later:

- `slug`
- `currency`
- `image_url`
- `is_available`
- `is_featured`
- `seo_title`
- `seo_description`

Risk level:

- Medium, because `/food` already works and must not be broken.

Conclusion:

- protect `/food`
- keep `menu_items` canonical
- use additive-only migration later

## Shop / products

Current strengths:

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

Current missing fields:

- `slug`
- `currency`
- `image_url`
- `is_featured`
- `seo_title`
- `seo_description`

Read adapter/page readiness:

- `products` can support a `/shop` read pilot after adapter planning
- current table is enough for basic read cards if mapping is conservative

Migration required now:

- No.

Recommended additive fields later:

- `slug`
- `currency`
- `image_url`
- `is_featured`
- `seo_title`
- `seo_description`

Risk level:

- Medium, because shop touches stock/cart/payment-adjacent concepts even though this stage is read-only.

Conclusion:

- no duplicate `shop_products` table needed now
- keep `products`
- do not add checkout/payment/cart behavior
- ensure no alcohol products are shown

## Restaurants

Current strengths:

- `business_id`
- `delivery_enabled`
- `working_hours`
- `min_order_amount`
- `created_at`
- `updated_at`

Current missing fields:

- no blocking public-read fields if `partners` remains the public title/slug source

Read adapter/page readiness:

- usable as a restaurant operational/profile extension
- public title and slug should come from `partners`

Migration required now:

- No.

Recommended additive fields later:

- only if restaurant-specific public profile requirements appear

Risk level:

- Low.

Conclusion:

- restaurants can extend partners for food businesses
- use partners for public title/slug
- use restaurants for operational restaurant settings

## Shops

Current strengths:

- `business_id`
- `delivery_enabled`
- `working_hours`
- `created_at`
- `updated_at`

Current missing fields:

- no blocking public-read fields if `partners` remains the public title/slug source

Read adapter/page readiness:

- usable as a shop operational/profile extension

Migration required now:

- No.

Recommended additive fields later:

- only if shop-specific public profile requirements appear

Risk level:

- Low.

Conclusion:

- shops can extend partners for shop businesses
- use `products` for product catalog

## Tours

Current strengths:

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

Current missing fields:

- `image_url`
- `is_featured`
- `seo_title`
- `seo_description`

Read adapter/page readiness:

- `tours` is already close to usable
- can likely support a basic `/tours` read pilot with conservative mapping

Migration required now:

- No.

Recommended additive fields later:

- `image_url`
- `is_featured`
- `seo_title`
- `seo_description`

Risk level:

- Low to medium.

Conclusion:

- tours is likely the first candidate after food
- do not create a duplicate tours table

## Stays

Current strengths:

- `business_id`
- `category_id`
- `title`
- `slug`
- `type`
- `description`
- `location`
- `price_from`
- `currency`
- `status`
- `metadata`
- `created_at`
- `updated_at`

Current missing fields:

- `image_url`
- `capacity`
- `amenities`
- `is_featured`
- `seo_title`
- `seo_description`

Read adapter/page readiness:

- `stays` is usable for a read pilot
- availability/pricing/booking engine remains later

Migration required now:

- No.

Recommended additive fields later:

- `image_url`
- `capacity`
- `amenities`
- `is_featured`
- `seo_title`
- `seo_description`

Risk level:

- Medium because stays can lead into availability and booking workflows.

Conclusion:

- stays table is usable for read pilot
- availability/pricing engine later, not now

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- no alcohol categories/items should be added
- shop/products must not include alcohol
- food/menu drinks must be non-alcohol only
- `alcohol_module_settings` remains untouched
- public catalog must not enable alcohol sales/delivery

## Migration Priority

Recommended priority:

1. Protect and align `menu_items`.
2. Plan `/tours` read adapter using current fields.
3. Plan `/stays` read adapter using current fields.
4. Plan `/shop` / products read adapter using current fields.
5. Add additive image/SEO fields later if approved.
6. Add availability/pricing later as read-only first.

## Final Decision

- no full migration needed
- no duplicate tables needed
- no `catalog_categories` needed now
- no `shop_products` duplicate needed now
- minimal additive migration only after final approval
- do not apply SQL in this stage

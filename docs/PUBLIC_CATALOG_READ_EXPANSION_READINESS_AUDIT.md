# Stage 20-4 - Public Catalog Read Expansion Readiness Audit

## Goal

Determine whether public catalog read mode can expand beyond `/food` before migration, or whether a minimal additive migration should happen first.

Audit target pages:

- `/tours`
- `/stays`
- `/shop`

Verified source tables:

- `tours`
- `stays`
- `products`
- `shops`
- `partners`
- `categories`

This stage is documentation only. It does not implement adapters, wire UI, create SQL migrations, apply SQL, add writes, add payments/bookings/carts/checkout or enable the alcohol module.

## /tours Readiness

Verified current fields:

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
- timestamps

Strengths:

- has route-ready `slug`
- has core public card/detail fields
- has `business_id = partners.id`
- has `category_id = categories.id`
- has `price` and `currency`
- has `status` for active-only reads

Missing non-blocking fields:

- `image_url`
- `is_featured`
- `seo_title`
- `seo_description`

Decision:

- likely ready for a read adapter now
- image/SEO/featured fields can be added later
- use mock/fallback visuals if image fields are missing

Risk:

- Low to medium.

## /stays Readiness

Verified current fields:

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
- timestamps

Strengths:

- has route-ready `slug`
- has public title/location/price fields
- has `business_id = partners.id`
- has `category_id = categories.id`
- has `status` for active-only reads

Missing non-blocking fields:

- `capacity`
- `amenities`
- `image_url`
- `is_featured`
- `seo_title`
- `seo_description`

Decision:

- likely ready for a basic read adapter now
- capacity/amenities/images/SEO can be added later
- availability/pricing engine is later and should remain read-only first

Risk:

- Medium, because stays naturally lead toward booking/availability flows.

## /shop Readiness

Verified current `products` fields:

- `business_id`
- `category_id`
- `title`
- `description`
- `price`
- `stock_qty`
- `status`
- `metadata`
- timestamps

Verified current `shops` fields:

- `business_id`
- `delivery_enabled`
- `working_hours`
- timestamps

Strengths:

- product catalog base exists
- product ownership uses `business_id = partners.id`
- product category relation exists
- shop profile extension exists

Missing fields:

- `slug`
- `currency`
- `image_url`
- `is_featured`
- `seo_title`
- `seo_description`

Decision:

- possible read adapter, but lower priority than tours/stays
- missing slug/currency/image fields make direct public route/card mapping less polished
- no cart/checkout/payment writes should be added

Risk:

- Medium to high compared with tours/stays, because shop touches stock/cart/payment-adjacent concepts and requires explicit no-alcohol filtering.

## Shared Categories

Verified `categories` fields:

- `scope`
- `title`
- `slug`
- `parent_id`
- `sort_order`
- timestamps

Decision:

- usable for joins
- `scope` supports domain separation
- no `catalog_categories` table is needed now

Potential later additive field:

- `is_active`, only if category visibility control is required

## Public Adapter Pattern

Use the same pattern as `/food`:

- `DATA_SOURCE_MODE=mock` returns existing mock data
- `DATA_SOURCE_MODE=supabase` calls safe read adapter
- read failure falls back to mock
- safe labels/messages only
- no raw Supabase, SQL, auth or env errors
- no page-load writes

Safe codes:

- `supabase_not_configured`
- `table_missing`
- `read_failed`
- `empty_result`
- `server_error`

## No-Write Rule

Read expansion must not:

- create orders
- create bookings
- create cart
- create checkout
- update availability
- update stock
- insert `audit_logs`
- change payments
- touch `alcohol_module_settings`
- enable alcohol sales/delivery

## Alcohol

- `ALCOHOL_MODULE_ENABLED=false`
- `/shop` must not show alcohol products
- `/food` drinks must be non-alcohol
- no alcohol category
- no alcohol delivery/sales
- alcohol settings remain untouched

## Readiness Decisions

| Page | Readiness | Recommended approach | Risk |
| --- | --- | --- | --- |
| `/tours` | Likely ready now | Build read adapter using current fields, fallback images/SEO | Low/medium |
| `/stays` | Likely ready for basic adapter | Build read adapter using current fields, defer availability/pricing | Medium |
| `/shop` | Possible but lower priority | Defer until slug/currency/image/no-alcohol mapping is clearer | Medium/high |

## Recommended Stage 21

Options:

- Stage 21 - Minimal Additive Catalog Migration Draft
- Stage 21 - Tours Public Supabase Read Adapter

Recommendation:

- Do Minimal Additive Catalog Migration Draft first, but do not apply it yet.

Reason:

- the existing schema is usable, but additive image/SEO/currency/availability clarity will make later adapters cleaner
- draft-first still avoids actual DB changes
- `/food` remains protected

If speed matters more than data quality, `/tours` read adapter can be done first because the `tours` table is already usable.

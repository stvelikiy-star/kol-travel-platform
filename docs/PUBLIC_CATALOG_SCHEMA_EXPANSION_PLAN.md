# Stage 18-1 - Public Catalog Schema Expansion Plan

## Current State

Stage 17 completed the first public catalog Supabase read pilot.

Current implementation:

- `/food` has a real read-only adapter using `public.menu_items`.
- Optional read joins exist for `categories(title)` and `partners(title, slug)`.
- `getPublicFoodReadResult()` keeps mock fallback available.
- `DATA_SOURCE_MODE=mock` returns `getMockFood()`.
- `DATA_SOURCE_MODE=supabase` calls the controlled Supabase read adapter.
- `/food` shows safe mode labels.
- Other public catalog pages may still rely on mock/static data.

Stage 18-1 is documentation only. It does not create schema, SQL migrations, adapters, UI wiring, writes, cart, checkout, booking, payment logic or alcohol-module behavior.

## Target Catalog Domains

Future public catalog schema should cover:

- Tours
- Stays / accommodation
- Food / restaurants / menu items
- Shop / products
- Shared categories
- Shared images/media
- Availability and pricing
- SEO/public metadata
- Moderation and public status fields

Mock fallback must remain available while each domain is validated.

## Partners Relationship

The existing `partners` table should remain the business owner/source:

- `partners.id`
- `partners.type`
- `partners.title`
- `partners.slug`

Catalog records should reference:

- `business_id = partners.id`

Do not introduce `partner_id` for catalog ownership if the current platform schema uses `business_id`.

## Proposed Tables

Recommended future tables:

- `catalog_categories`
- `catalog_images`
- `catalog_tags`
- `tours`
- `tour_images`
- `stays`
- `stay_images`
- `stay_availability`
- `stay_pricing`
- `restaurants` or `partner_food_profiles`
- `menu_items`
- `menu_item_images`
- `shops` or `partner_shop_profiles`
- `shop_products`
- `shop_product_images`

These are planning targets only. Do not create them until the schema draft stage.

## Food / Restaurants / Menu

`menu_items` should remain the canonical food item table unless Stage 18-4 finds a blocking mismatch.

Recommended `menu_items` fields:

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
- `created_at`
- `updated_at`

Restaurant/business profile options:

- keep restaurants as `partners` with `partners.type = food`
- or add `partner_food_profiles` for restaurant-specific public settings

In both options, menu items should still use `business_id = partners.id`.

## Tours

Recommended `tours` fields:

- `id`
- `business_id` nullable if a tour can be platform-operated
- `category_id`
- `title`
- `slug`
- `short_description`
- `description`
- `location`
- `duration_label`
- `price_from`
- `currency`
- `included`
- `excluded`
- `difficulty`
- `season`
- `is_featured`
- `status`
- `metadata`
- `seo_title`
- `seo_description`
- `created_at`
- `updated_at`

Tour availability/pricing should be read-only first. Booking writes come later.

## Stays / Accommodation

Recommended `stays` fields:

- `id`
- `business_id`
- `category_id`
- `title`
- `slug`
- `short_description`
- `description`
- `location`
- `address`
- `capacity`
- `bedrooms`
- `beds`
- `amenities`
- `price_from`
- `currency`
- `check_in_time`
- `check_out_time`
- `is_featured`
- `status`
- `metadata`
- `seo_title`
- `seo_description`
- `created_at`
- `updated_at`

Related future tables:

- `stay_images`
- `stay_availability`
- `stay_pricing`

Availability and pricing reads should be validated before any booking engine writes.

## Shop / Products

Recommended `shop_products` fields:

- `id`
- `business_id`
- `category_id`
- `title`
- `slug`
- `description`
- `price`
- `currency`
- `stock_status`
- `stock_quantity` optional
- `image_url`
- `is_featured`
- `status`
- `metadata`
- `seo_title`
- `seo_description`
- `created_at`
- `updated_at`

Shop/business profile options:

- keep shops as `partners` with `partners.type = shop`
- or add `partner_shop_profiles` for shop-specific public settings

Products should reference `business_id = partners.id`.

## Categories

Shared `catalog_categories` should support:

- `id`
- `parent_id` nullable
- `domain`: `tour | stay | food | shop`
- `title`
- `slug`
- `description`
- `sort_order`
- `is_active`
- `created_at`
- `updated_at`

Public pages should show only active categories.

## Images / Media

One shared `catalog_images` table can cover all public catalog media:

- `id`
- `entity_type`
- `entity_id`
- `url`
- `alt`
- `sort_order`
- `is_cover`
- `created_at`
- `updated_at`

Separate image tables, such as `tour_images` or `shop_product_images`, are acceptable if they make RLS and query mapping simpler. The public adapter should still return a stable image shape.

## Availability And Pricing

Availability/pricing should be read-only before any booking or checkout write flow.

Future stages can add:

- `stay_availability`
- `stay_pricing`
- `tour_schedules`
- `tour_pricing`
- product stock fields

No public page should update availability, pricing, bookings, cart or checkout during schema expansion.

## SEO / Public Metadata

Public catalog tables should include:

- `slug`
- `seo_title`
- `seo_description`
- `is_featured`
- `status`
- `metadata`
- `created_at`
- `updated_at`

Detail pages should resolve by slug and return safe not-found behavior when missing.

## Status And Moderation

All public catalog items should have:

- `status`: `draft | active | hidden | archived`

Public pages should show only `active` records.

Future partner/admin workflows can manage:

- draft creation
- partner edits
- admin moderation
- hiding/archiving
- audit logs

No public writes are part of Stage 18-1.

## RLS And Security

Production must later enforce:

- public users can read active catalog items only
- partners can manage only their own `business_id` catalog items
- admins can moderate catalog records
- service role key remains server-side only
- no private environment variables are exposed to client components
- adapters return safe errors only

Read adapters must not show raw Supabase, SQL, auth or env errors.

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- No alcohol categories/items should appear in the public catalog.
- Food/shop schema may support future legal gating, but it must remain disabled by default.
- Client, partner, courier and admin roles cannot enable alcohol.
- AI cannot enable alcohol.
- Do not touch `alcohol_module_settings`.
- Any future alcohol activation requires legal review, licensing, partner verification and `super_admin` approval.

## Migration Strategy

Recommended next stages:

1. 18-2 Schema Draft SQL Plan
2. 18-3 Catalog Seed Data Plan
3. 18-4 Food Schema Alignment Audit
4. 18-5 Tours/Stays/Shop Adapter Plan
5. 18-6 Public Catalog Schema Final Audit

Implementation should remain read-first, with mock fallback and rollback at every step.

## Rollback

This stage is docs-only.

Rollback, if needed:

1. Revert this document and README status line.
2. Keep `DATA_SOURCE_MODE=mock`.
3. Keep `ALCOHOL_MODULE_ENABLED=false`.

No database changes were made, and no schema rollback is required.

## Blockers And Risks

Risks to resolve before SQL work:

- table naming must match existing Supabase schema conventions
- existing `menu_items` shape must be aligned before expanding food
- partner ownership must stay `business_id = partners.id`
- image and category relationships need stable public query shape
- public pages must not expose draft/hidden/archived records
- no alcohol category/product leakage is allowed

## Final Plan Decision

Proceed to Stage 18-2 with a schema draft SQL plan only after this table plan is reviewed.

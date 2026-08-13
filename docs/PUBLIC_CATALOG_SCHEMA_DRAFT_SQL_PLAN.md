# Stage 18-2 - Public Catalog Schema Draft SQL Plan

## Migration Goal

Plan a future SQL migration structure for the public catalog system without creating SQL files yet.

The future schema should:

- create complete public catalog tables for tours, stays, food/menu and shop products
- keep `partners` as the business source
- reference `partners.id` through `business_id`
- avoid introducing `partner_id` where current schema uses `business_id`
- support public read-only catalogs first
- support partner/admin management later
- preserve mock fallback while each domain is validated

This stage is documentation only. It does not apply schema changes, create migrations, implement adapters, wire UI, add writes, add checkout/cart/booking/payment logic or enable the alcohol module.

## Existing Schema Compatibility

Known existing tables:

- `partners`
- `menu_items`
- `categories` if present
- `orders`
- `audit_logs`
- `alcohol_module_settings`

Compatibility rules:

- Do not break the current `/food` read adapter.
- Do not rename existing `menu_items` without a migration strategy.
- If `menu_items` already exists, align it instead of creating a duplicate food table.
- Keep `business_id = partners.id` as the ownership relationship.
- Keep `DATA_SOURCE_MODE=mock` as the safe default during rollout.

## Proposed Future SQL Files

Future migration files to plan, but not create in this stage:

- `004_public_catalog_schema_draft.sql`
- `005_public_catalog_seed_demo_data.sql`
- `006_public_catalog_rls_policies_draft.sql`

Recommended order:

1. Schema tables and indexes.
2. Demo seed data.
3. RLS policies and public read restrictions.

## Table Plan Overview

Planned tables:

- `catalog_categories`
- `catalog_images`
- `tours`
- `tour_images` if separate image tables are chosen
- `stays`
- `stay_images` if separate image tables are chosen
- `stay_availability`
- `stay_pricing`
- `menu_items` alignment if needed
- `menu_item_images` if separate image tables are chosen
- `shops` or `partner_shop_profiles`
- `shop_products`
- `shop_product_images` if separate image tables are chosen

Each table should include a primary key, timestamps, status/moderation fields where public visibility is involved, and indexes for public read performance.

## Required Relationships

- Business-owned catalog records reference `business_id = partners.id`.
- Shared categories can be reused across domains.
- Images should reference either `entity_type/entity_id` in a shared table or use separate entity-specific image tables.
- Public pages should read only `status = 'active'`.
- Partner/admin write flows come later and must be protected by auth, ownership checks, RLS and audit.

## catalog_categories

Purpose:

- Shared category taxonomy for public catalog domains.

Planned columns:

- `id uuid primary key`
- `parent_id uuid nullable references catalog_categories(id)`
- `domain text check (domain in ('tour', 'stay', 'food', 'shop'))`
- `title text not null`
- `slug text not null`
- `description text nullable`
- `sort_order int default 0`
- `is_active boolean default true`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Indexes:

- `(domain, slug)`
- `(domain, is_active, sort_order)`
- `parent_id`

RLS:

- public can select active categories
- partners/admins can manage later according to permission model

Rollback:

- safe to drop before dependent catalog tables in a test project only

## tours

Purpose:

- Public tour catalog and future partner/admin tour management.

Planned columns:

- `id uuid primary key`
- `business_id uuid nullable references partners(id)`
- `category_id uuid nullable references catalog_categories(id)`
- `title text not null`
- `slug text unique not null`
- `short_description text`
- `description text`
- `location text`
- `duration_label text`
- `price_from numeric`
- `currency text default 'KGS'`
- `included jsonb default '[]'::jsonb`
- `excluded jsonb default '[]'::jsonb`
- `difficulty text`
- `season text`
- `is_featured boolean default false`
- `status text check (status in ('draft', 'active', 'hidden', 'archived')) default 'draft'`
- `metadata jsonb default '{}'::jsonb`
- `seo_title text`
- `seo_description text`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Indexes:

- `slug`
- `business_id`
- `category_id`
- `status`
- `(status, is_featured, created_at)`

RLS:

- public can select active tours
- partners can manage own `business_id` tours later
- admin can moderate later

Rollback:

- drop images/pricing/availability references first if separate dependent tables exist

## stays

Purpose:

- Public accommodation catalog and future stay partner management.

Planned columns:

- `id uuid primary key`
- `business_id uuid not null references partners(id)`
- `category_id uuid nullable references catalog_categories(id)`
- `title text not null`
- `slug text unique not null`
- `short_description text`
- `description text`
- `location text`
- `address text`
- `capacity int`
- `bedrooms int`
- `beds int`
- `amenities jsonb default '[]'::jsonb`
- `price_from numeric`
- `currency text default 'KGS'`
- `check_in_time text`
- `check_out_time text`
- `is_featured boolean default false`
- `status text check (status in ('draft', 'active', 'hidden', 'archived')) default 'draft'`
- `metadata jsonb default '{}'::jsonb`
- `seo_title text`
- `seo_description text`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Indexes:

- `slug`
- `business_id`
- `category_id`
- `status`
- `(status, is_featured, created_at)`

RLS:

- public can select active stays
- stay partners can manage own `business_id` records later
- admin can moderate later

## Food / menu_items Alignment

Purpose:

- Preserve `menu_items` as the canonical food catalog table because `/food` already reads it.

Recommended aligned columns:

- `id uuid primary key`
- `business_id uuid not null references partners(id)`
- `category_id uuid nullable references catalog_categories(id)`
- `title text not null`
- `slug text`
- `description text`
- `price numeric not null`
- `currency text default 'KGS'`
- `image_url text`
- `is_available boolean default true`
- `is_featured boolean default false`
- `status text check (status in ('draft', 'active', 'hidden', 'archived')) default 'draft'`
- `metadata jsonb default '{}'::jsonb`
- `seo_title text`
- `seo_description text`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Indexes:

- `business_id`
- `category_id`
- `status`
- `slug`
- `(status, is_available, is_featured)`

RLS:

- public can select active and available menu items
- food partners can manage own `business_id` menu items later
- admin can moderate later

Migration note:

- If existing `menu_items` lacks some fields, add nullable/defaulted fields in a backward-compatible migration.
- Do not duplicate food item data into a second table.

## shops / partner_shop_profiles

Purpose:

- Store shop-specific public settings if `partners` alone is not enough.

Recommended approach:

- keep `partners` as the business source
- add `partner_shop_profiles` only for shop-specific settings later

Possible columns:

- `id uuid primary key`
- `business_id uuid unique references partners(id)`
- `public_title text`
- `short_description text`
- `delivery_note text`
- `status text default 'active'`
- `metadata jsonb default '{}'::jsonb`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

## shop_products

Purpose:

- Public shop product catalog and future partner/admin product management.

Planned columns:

- `id uuid primary key`
- `business_id uuid not null references partners(id)`
- `category_id uuid nullable references catalog_categories(id)`
- `title text not null`
- `slug text`
- `description text`
- `price numeric not null`
- `currency text default 'KGS'`
- `stock_status text`
- `stock_quantity int nullable`
- `image_url text`
- `is_featured boolean default false`
- `status text check (status in ('draft', 'active', 'hidden', 'archived')) default 'draft'`
- `metadata jsonb default '{}'::jsonb`
- `seo_title text`
- `seo_description text`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Indexes:

- `business_id`
- `category_id`
- `status`
- `slug`
- `(status, is_featured, created_at)`

RLS:

- public can select active products
- shop partners can manage own `business_id` products later
- admin can moderate later

## Images

Recommended approach: use one shared `catalog_images` table first.

Why:

- one adapter pattern for all domains
- simpler media ordering and cover-image logic
- easier future media moderation
- less repeated table structure

Planned columns:

- `id uuid primary key`
- `entity_type text not null`
- `entity_id uuid not null`
- `url text not null`
- `alt text`
- `sort_order int default 0`
- `is_cover boolean default false`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Indexes:

- `(entity_type, entity_id)`
- `(entity_type, entity_id, is_cover)`
- `(entity_type, entity_id, sort_order)`

RLS:

- public can select images for active public entities only, or images can be selected through server-side adapters
- partner/admin write policies come later

Alternative:

- separate `tour_images`, `stay_images`, `menu_item_images`, `shop_product_images` if RLS or query simplicity requires it later

## Availability And Pricing

Plan read-first tables only.

`stay_availability`:

- `id uuid primary key`
- `stay_id uuid references stays(id)`
- `date date`
- `status text`
- `available_units int`
- `created_at timestamptz`
- `updated_at timestamptz`

`stay_pricing`:

- `id uuid primary key`
- `stay_id uuid references stays(id)`
- `date date nullable`
- `season_label text nullable`
- `price numeric`
- `currency text default 'KGS'`
- `created_at timestamptz`
- `updated_at timestamptz`

Optional future tour tables:

- `tour_availability`
- `tour_pricing`

No booking writes are included in this plan.

## Index Plan

Recommended indexes:

- `slug` on public detail entities
- `business_id` on business-owned catalog tables
- `category_id` on catalog tables
- `status` on public catalog tables
- `is_featured` for homepage and featured sections
- `created_at` for recent ordering
- `(domain, slug)` on categories
- `(domain, is_active, sort_order)` on categories

## RLS And Security Plan

Future policies:

- public can select active catalog items only
- public cannot read draft, hidden or archived records
- partners can manage only records where `business_id` belongs to their partner profile
- admins can moderate
- service role remains server-side only
- private environment variables are never exposed in client components

Adapters must return safe errors only:

- `supabase_not_configured`
- `table_missing`
- `read_failed`
- `empty_result`
- `server_error`

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- no alcohol categories/items in seed
- public catalog cannot enable alcohol sales or delivery
- schema may include future compliance fields only if documented as inactive
- client, partner, courier and admin roles cannot enable alcohol
- AI cannot enable alcohol
- do not touch `alcohol_module_settings`

Any future alcohol activation requires legal review, licensing, partner verification and `super_admin` approval.

## No-Write Guarantee

This planning stage does not create:

- orders
- bookings
- carts
- checkout sessions
- payments
- audit logs
- schema changes
- SQL migration files

## Rollback

This stage is docs-only:

- no DB rollback
- no schema rollback
- no mock-data rollback
- mock fallback remains active

Rollback is limited to reverting this document and README status if needed.

## Risks And Blockers

- Existing `menu_items` must be inspected before any alignment SQL.
- Category table naming must avoid conflicts with any existing `categories` table.
- Image strategy should be chosen once and kept stable.
- Public policies must avoid exposing draft/hidden records.
- Alcohol-like categories or products must not be seeded or shown.

## Final Plan Decision

Use a read-first schema expansion approach:

1. Align existing `menu_items` safely.
2. Add shared categories and image strategy.
3. Add tours, stays and shop products.
4. Add read-only availability/pricing.
5. Add RLS and seed data only after schema review.

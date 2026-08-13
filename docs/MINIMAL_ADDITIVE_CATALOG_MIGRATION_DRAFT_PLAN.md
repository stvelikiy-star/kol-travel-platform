# Stage 21-1 - Minimal Additive Catalog Migration Draft Plan

## Goal

Plan a future additive-only SQL draft that improves the existing catalog tables without breaking current read pilots.

This stage is documentation only. It does not apply SQL, run Supabase SQL, modify schema files, create production migrations, implement adapters, wire UI, add writes, add payments/bookings/carts/checkout or enable the alcohol module.

## Why Migration Is Minimal

Manual Supabase verification confirmed that the existing schema already works as a base:

- `/food` adapter works with `public.menu_items`
- `tours` is close to usable for a read adapter
- `stays` is close to usable for a basic read adapter
- `products` exists for shop catalog reads
- `categories` already exists with `scope`, `slug`, `parent_id` and `sort_order`
- `partners` remains the business source

Full schema redesign would create unnecessary risk. The safer path is additive alignment.

## Migration Principles

Future migration drafts must follow:

- additive only
- no drop
- no rename
- no destructive changes
- no duplicate base tables
- no `partner_id`
- protect `/food` adapter
- keep mock fallback
- keep `DATA_SOURCE_MODE=mock` as safe default
- no writes enabled by migration
- preserve existing data

## What Not To Create

Do not create:

- `catalog_categories`
- `shop_products`
- duplicate `tours`
- duplicate `stays`
- duplicate `menu_items`
- duplicate `products`
- duplicate `restaurants`
- duplicate `shops`
- `partner_id`

Keep:

- `categories`
- `products`
- `menu_items`
- `business_id = partners.id`

## Planned Additive Fields

Only add fields if manual verification and review confirm they are still missing.

### menu_items

Planned additive fields:

- `slug text`
- `currency text default 'KGS'`
- `image_url text`
- `is_available boolean default true`
- `is_featured boolean default false`
- `seo_title text`
- `seo_description text`

Reason:

- improve public food URLs/cards/SEO
- keep current `/food` adapter working
- allow future active and available filtering

### products

Planned additive fields:

- `slug text`
- `currency text default 'KGS'`
- `image_url text`
- `is_featured boolean default false`
- `seo_title text`
- `seo_description text`

Reason:

- improve `/shop` read adapter readiness
- avoid creating duplicate `shop_products`
- keep cart/checkout/payment out of scope

### tours

Planned additive fields:

- `image_url text`
- `is_featured boolean default false`
- `seo_title text`
- `seo_description text`

Reason:

- `tours` already has slug/title/location/price/currency/duration/status
- additive fields improve public cards and SEO without blocking current data

### stays

Planned additive fields:

- `image_url text`
- `capacity integer`
- `amenities jsonb default '{}'::jsonb`
- `is_featured boolean default false`
- `seo_title text`
- `seo_description text`

Reason:

- `stays` already has slug/title/type/location/price_from/currency/status
- additive fields improve public cards and accommodation filtering
- availability/pricing stays out of this migration

### categories Optional

Optional field:

- `is_active boolean default true`

Only include if justified in the draft review.

Reason:

- `categories` already has `scope`, `slug`, `parent_id` and `sort_order`
- category visibility may be useful later
- not required for the current `/food` read pilot

## Draft Migration Strategy

Future draft SQL should:

- use `alter table ... add column if not exists`
- create indexes with `create index if not exists`
- avoid constraints that can fail existing data
- avoid `not null` on newly added fields unless a safe default and backfill are already verified
- avoid global unique slug constraints at first
- avoid data deletion
- avoid renames
- avoid table duplication

## Proposed Draft SQL Sections

Future Stage 21-2 SQL draft should be organized as:

1. Header warning: DRAFT ONLY, not applied.
2. Preconditions and safety notes.
3. `menu_items` additive columns.
4. `products` additive columns.
5. `tours` additive columns.
6. `stays` additive columns.
7. Optional `categories.is_active`.
8. Indexes.
9. Comments.
10. Test plan notes.
11. Rollback notes for TEST project only.

Do not include RLS or seed data in the first additive migration draft.

## Index Plan

Potential indexes:

- `menu_items.slug`
- `menu_items.business_id`
- `menu_items.category_id`
- `menu_items.status`
- `menu_items.is_available`
- `menu_items.is_featured`
- `products.slug`
- `products.business_id`
- `products.category_id`
- `products.status`
- `tours.slug`
- `tours.status`
- `tours.is_featured`
- `stays.slug`
- `stays.status`
- `stays.is_featured`

Rules:

- do not create an index on a missing column unless the column is added in the same draft
- avoid redundant indexes if existing indexes already cover the query
- prefer non-unique slug indexes at first

## Slug Uniqueness

Do not force global unique slug immediately unless data is verified clean.

Initial preference:

- non-unique slug indexes
- adapter-level safe handling of duplicates if needed
- future partial unique indexes after seed/backfill QA

Potential later uniqueness options:

- unique `(business_id, slug)` for business-owned records
- unique `(scope, slug)` for categories
- partial unique index only for active records if justified

## RLS

Do not implement RLS in this migration draft.

RLS should be a separate future stage:

- public can read active items only
- partners can write own `business_id` items
- admin can moderate
- service role remains server-side only
- no private env exposure

## Seed Data

Do not add seed data in this stage.

Seed updates later after migration review:

- add safe demo slugs
- add safe image paths
- add non-alcohol food/shop data
- avoid private data
- use existing demo partner where possible

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- no alcohol category/items
- do not touch `alcohol_module_settings`
- no alcohol activation path
- shop/products must not enable alcohol
- food/menu drinks must remain non-alcohol
- AI cannot enable alcohol
- client, partner, courier and admin cannot enable alcohol

## Testing Plan

Before applying a future migration:

- backup/export TEST project data
- set `DATA_SOURCE_MODE=mock`
- run `npm run build`
- verify `/food` mock mode
- verify `/food` Supabase read mode
- verify no writes on page load
- verify `ALCOHOL_MODULE_ENABLED=false`

After applying in TEST project later:

- verify `/food` still works
- verify `menu_items` read
- verify `categories(title)` join
- verify `partners(title, slug)` join
- verify alcohol settings remain false
- verify `npm run build`
- document results before adapter changes

## Rollback Strategy

Since migration should be additive:

- rollback usually should not be needed
- if behavior breaks, disable Supabase mode and use mock fallback
- do not drop added columns immediately
- preserve data
- document manual rollback only for TEST project

Potential TEST-only rollback notes:

- disable `DATA_SOURCE_MODE=supabase`
- review adapter assumptions
- avoid destructive cleanup unless TEST project can be reset safely

## Risks And Blockers

- exact additive SQL must still be reviewed before creating a draft file
- existing indexes must be checked before adding new indexes
- slug duplicates may exist or appear later
- image paths require a seed/media strategy
- RLS is out of scope and still needs its own review
- seed data remains minimal
- `/shop` needs explicit alcohol exclusion

## Next Stages

Recommended sequence:

1. 21-2 Draft SQL File Creation - DRAFT ONLY, not applied
2. 21-3 Draft Migration Review
3. 21-4 Apply Decision Checklist
4. 21-5 Stage 21 Final Audit

Do not apply SQL until the draft is reviewed and approved.

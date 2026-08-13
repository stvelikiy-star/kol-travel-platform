# Stage 19-3 - Catalog Migration Decision Matrix

## Goal

Define decision rules for whether each public catalog domain needs no migration, a minimal alignment migration, an additive migration, a full migration later, or no migration yet.

This document is planning only. It does not create SQL migrations, modify schema files, apply Supabase SQL, implement adapters, wire UI, add writes, add payments/bookings/carts/checkout or enable the alcohol module.

## Decision Categories

### A. No Migration Needed

Use when:

- current table exists
- required fields for the current read UI exist
- joins and relationships are verified
- active-only public read is possible
- mock fallback remains

### B. Minimal Alignment Migration

Use when:

- current table is mostly compatible
- a small number of nullable/defaulted fields are missing
- current adapters can keep working
- no column rename/drop is needed

### C. Additive Migration

Use when:

- current table can be extended safely
- new indexes or helper columns are needed
- new read-only availability/pricing tables are needed
- data can be backfilled safely later

### D. Full Migration Later

Use when:

- current table shape is incompatible
- relationships are unclear or wrong
- domain model needs a redesign
- a temporary adapter would create too much risk

### E. Do Not Migrate Yet

Use when:

- manual SQL verification is incomplete
- changing schema could break `/food`
- RLS/security state is unknown
- alcohol/product compliance risk is unclear
- seed data is missing or unsafe

## Food / menu_items Decision Rules

No migration needed if:

- `/food` adapter works
- `menu_items` has required fields for current UI
- joins to `categories(title)` and `partners(title, slug)` work
- active-only filtering works

Minimal alignment migration if missing:

- `slug`
- `currency`
- `image_url`
- `is_available`
- `is_featured`
- `seo_title`
- `seo_description`

Do not migrate if:

- actual schema is unclear
- `/food` adapter could break
- manual SQL verification is not completed
- category/partner joins are not verified

Recommended default:

- minimal additive alignment only after manual verification confirms missing fields.

## Tours Decision Rules

No migration needed if:

- `tours` table exists
- table has `slug`, `title`, `description`, `location`, `price` or `price_from`, and `status`
- table can support `/tours` page without schema changes
- active-only read is possible

Additive migration if missing:

- `category_id`
- `image_url` or cover image relationship
- SEO fields
- `status`
- `is_featured`
- `metadata`

Full migration later if:

- `tours` table shape is incompatible
- relationship to `partners.id` through `business_id` is unclear
- public tour model cannot be supported by current fields

## Stays Decision Rules

No migration needed if:

- `stays` table exists
- table has `slug`, `title`, `location`, `price_from` or `price`, and `status`
- table can support `/stays` page without schema changes

Additive migration if missing:

- `capacity`
- `amenities`
- images
- availability
- pricing
- SEO fields
- `is_featured`

Full migration later if:

- `stays` table does not support accommodation domain needs
- stay/room relationship is unclear
- future booking-read requirements require a separate model

## Shop / products Decision Rules

No migration needed if:

- `products` table exists
- table has `title`, `price`, `status`, and `business_id`
- table can support `/shop` page read-only
- alcohol products are absent/excluded

Additive migration if missing:

- `slug`
- `currency`
- `stock_status`
- `image_url`
- `category_id`
- SEO fields
- `is_featured`

Do not implement checkout/payment here.

Do not migrate if:

- alcohol filtering cannot be verified
- product/private data safety is unclear
- stock/payment behavior is being mixed into read-mode work

## Categories Decision Rules

Keep existing `categories` if:

- joins already work
- `title` exists
- category usage is simple
- `scope` can safely serve the role of catalog domain

Add `catalog_categories` later only if:

- domain separation is needed and current `scope` is insufficient
- parent-child categories are needed beyond current capability
- `slug`, `sort_order` or `is_active` behavior is missing and cannot be added safely
- duplicate naming risk is resolved

Default:

- prefer aligning existing `categories` over creating a duplicate category table.

## Images Decision Rules

Use `image_url` fields first if:

- one image per card is enough
- public UI only needs cover image
- seed/image management should remain simple

Add `catalog_images` later if:

- multiple images per entity are needed
- cover/gallery sorting is needed
- alt text is needed
- media moderation is needed
- shared adapter behavior becomes useful across domains

Do not add image tables before the target domain table is verified.

## Availability / Pricing Decision Rules

Do not implement writes yet.

Plan later:

- `stay_availability`
- `stay_pricing`
- `tour_availability`
- `tour_pricing`

Only add read-first availability/pricing tables after:

- public read shape is verified
- seed data is planned
- booking writes are explicitly out of scope
- rollback to mock remains available

## Safety Rules

Migration must be additive first:

- do not rename existing columns
- do not drop existing columns
- do not break `/food` adapter
- do not remove mock fallback
- do not enable writes by default
- do not duplicate existing tables without manual verification
- preserve existing data

## RLS / Security Rules

Before production:

- public can read active items only
- partners can write only own `business_id` items later
- admins can moderate later
- service role stays server-side only
- no private env variables in client components
- safe errors only in public UI

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- no alcohol categories/items
- no alcohol delivery/sales
- no alcohol settings touched
- client, partner, courier and admin cannot enable alcohol
- AI cannot enable alcohol

Any future alcohol activation requires legal review, licensing, partner verification and `super_admin` approval.

## Blank Decision Matrix

| Domain | Current table | Current status | Gaps | Decision | Recommended migration type | Risk | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Food / menu_items | `menu_items` | `[manual result]` | `[manual result]` | `[A/B/C/D/E]` | `[none/minimal/additive/full/defer]` | `[low/medium/high]` | Protect `/food`. |
| Tours | `tours` | `[manual result]` | `[manual result]` | `[A/B/C/D/E]` | `[none/minimal/additive/full/defer]` | `[low/medium/high]` | Verify public route fields. |
| Stays | `stays` | `[manual result]` | `[manual result]` | `[A/B/C/D/E]` | `[none/minimal/additive/full/defer]` | `[low/medium/high]` | Verify room/availability needs. |
| Shop / products | `products` | `[manual result]` | `[manual result]` | `[A/B/C/D/E]` | `[none/minimal/additive/full/defer]` | `[low/medium/high]` | Exclude alcohol. |
| Categories | `categories` | `[manual result]` | `[manual result]` | `[A/B/C/D/E]` | `[none/minimal/additive/full/defer]` | `[low/medium/high]` | Avoid duplicate taxonomy. |
| Images | `[image_url/catalog_images]` | `[manual result]` | `[manual result]` | `[A/B/C/D/E]` | `[none/minimal/additive/full/defer]` | `[low/medium/high]` | Prefer simple cover first. |
| Availability/pricing | `[varies]` | `[manual result]` | `[manual result]` | `[A/B/C/D/E]` | `[none/minimal/additive/full/defer]` | `[low/medium/high]` | Read-only first. |

## Final Decision Rule

Do not proceed to migration planning until:

- manual verification results are pasted into `docs/MANUAL_SUPABASE_TABLE_VERIFICATION_RESULTS.md`
- `/food` adapter dependencies are confirmed
- `ALCOHOL_MODULE_ENABLED=false` is confirmed
- no table duplication risk remains unresolved

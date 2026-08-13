# Stage 18-6 - Public Catalog Schema Final Audit

## Summary

Stage 18 public catalog schema expansion planning is complete at the documentation level.

No SQL migrations, schema changes, adapters, UI wiring, writes, payment logic, booking/cart/checkout logic or alcohol module behavior were added in Stage 18.

## Files Reviewed

Required Stage 18 docs:

- `docs/PUBLIC_CATALOG_SCHEMA_EXPANSION_PLAN.md` - exists
- `docs/PUBLIC_CATALOG_SCHEMA_DRAFT_SQL_PLAN.md` - exists
- `docs/PUBLIC_CATALOG_SEED_DATA_PLAN.md` - exists
- `docs/FOOD_SCHEMA_ALIGNMENT_AUDIT.md` - exists
- `docs/TOURS_STAYS_SHOP_ADAPTER_PLAN.md` - exists

Final audit document:

- `docs/PUBLIC_CATALOG_SCHEMA_FINAL_AUDIT.md`

## No Schema Change Audit

Stage 18 did not create SQL migration files.

Stage 18 did not apply database changes.

Stage 18 planning docs reference existing schema files for audit purposes only:

- `supabase/schema/001_initial_schema.sql`
- `supabase/schema/002_rls_policies_draft.sql`
- `supabase/schema/003_seed_demo_data_draft_FIXED.sql`

No schema rollback is required because no schema change was made.

## No Code Implementation Audit

Stage 18 did not:

- implement new tours/stays/shop adapters
- wire new public UI pages
- add writes
- create orders/bookings/carts/checkout sessions
- add payment logic
- insert `audit_logs`
- touch `alcohol_module_settings`

Existing Stage 17 `/food` read pilot remains the only public catalog Supabase read pilot.

## Food Alignment Audit Summary

Current `/food` adapter:

- reads `public.menu_items`
- selects `id`, `business_id`, `title`, `description`, `price`, `status`
- optionally joins `categories(title)` and `partners(title,slug)`
- filters `status = active`
- orders by `created_at.desc`
- uses safe error paths and mock fallback through `getPublicFoodReadResult()`

Current `menu_items` schema includes:

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

Major gaps versus the future public catalog plan:

- missing `slug`
- missing `currency` column, although adapter currently uses `KGS`
- missing `image_url`
- missing `is_available`
- missing `is_featured`
- missing `seo_title`
- missing `seo_description`

Recommended later migration:

- use additive nullable/defaulted fields
- keep `menu_items` canonical
- do not duplicate food data
- update adapter only after schema and seed data are verified

## Proposed Future Schema Audit

Stage 18 plans cover:

- categories
- images
- tours
- stays
- food/menu
- shop/products
- availability
- pricing
- SEO metadata
- status/moderation
- RLS/security

Existing schema already contains some relevant tables:

- `categories`
- `tours`
- `stays`
- `rooms`
- `restaurants`
- `menu_items`
- `shops`
- `products`

Future work should verify whether to align these existing tables or introduce new names. Avoid duplicates unless there is a clear migration reason.

## Partner / Business Relationship Audit

Future catalog records should use:

- `business_id = partners.id`

No `partner_id` ownership assumption was introduced in Stage 18 docs.

This matches existing schema patterns for:

- `tours`
- `stays`
- `rooms`
- `restaurants`
- `menu_items`
- `shops`
- `products`

## Alcohol Audit

Stage 18 preserves:

- `ALCOHOL_MODULE_ENABLED=false`
- no alcohol categories/items planned for seed
- no alcohol sales/delivery in public catalog
- `alcohol_module_settings` untouched
- client, partner, courier and admin cannot enable alcohol
- AI cannot enable alcohol

Any future alcohol activation requires legal review, licensing, partner verification and `super_admin` approval.

## Security / RLS Audit

Future plan includes:

- public active-only reads
- partner own-business writes later
- admin moderation later
- service role server-side only
- no private env exposure
- safe adapter error codes only

Current RLS draft already includes active public reads for several catalog tables, but production readiness still requires manual RLS verification before new adapters are expanded.

## Rollback Audit

Stage 18 is docs-only.

Rollback is:

- revert Stage 18 docs
- revert README status if needed
- keep `DATA_SOURCE_MODE=mock`
- keep `ALCOHOL_MODULE_ENABLED=false`

No DB rollback, schema rollback or seed rollback is required.

## Risks And Blockers

- Actual existing `menu_items` and `categories` schema needs careful verification before any alignment migration.
- Tours/stays/shop tables exist, but their fields may not fully match the future public UI shape.
- Seed data has not been expanded or applied for the full public catalog.
- RLS policies are not production-verified for new public catalog adapter expansion.
- Partner management UI for future catalog writes is not implemented.
- Image strategy remains undecided for public catalog cards/details.
- Shop/product alcohol exclusion must be explicit before `/shop` Supabase read mode expands.

## Final Decision

Stage 18 is complete as a planning section.

Decision:

- safe at documentation/build level
- not yet ready to create migrations without manual schema verification

## Recommended Stage 19

Prefer:

- Stage 19 - Manual Supabase Schema Verification before migration

Reason:

- current schema already has many catalog tables
- table names and field alignment should be verified before drafting or applying any SQL migration
- this reduces duplicate table risk and protects the working `/food` adapter

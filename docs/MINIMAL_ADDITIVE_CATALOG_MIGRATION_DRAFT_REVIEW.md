# Stage 21-3 - Minimal Additive Catalog Migration Draft Review

## Reviewed File

- `supabase/schema/004_minimal_additive_catalog_fields_DRAFT_NOT_APPLIED.sql`

Review status:

- SQL has not been applied.
- No database changes were made.
- No app code was changed.
- No adapters, UI, actions, writes, payments, bookings, carts or checkout were added.

## Draft-Only Warning

The draft file contains the required warning:

- DRAFT ONLY
- NOT APPLIED
- DO NOT RUN IN PRODUCTION
- FOR REVIEW ONLY
- APPLY ONLY AFTER MANUAL APPROVAL AND BACKUP

## Additive-Only Review

Allowed statement types found:

- `alter table ... add column if not exists`
- `create index if not exists`
- `comment on table`
- `comment on column`

No destructive table or data operations are intended or needed.

## Duplicate Table Review

The draft does not create duplicate base tables.

It does not create:

- `catalog_categories`
- `shop_products`
- duplicate `tours`
- duplicate `stays`
- duplicate `menu_items`
- duplicate `products`
- duplicate `restaurants`
- duplicate `shops`

## Business Relationship Review

The draft does not introduce:

- `partner_id`

Current relationship remains:

- `business_id = partners.id`

## /food Adapter Protection

The draft does not change existing `menu_items` fields used by `/food`:

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

The draft only adds optional fields.

## Field Review

Reviewed additive fields:

- `menu_items`: `slug`, `currency`, `image_url`, `is_available`, `is_featured`, `seo_title`, `seo_description`
- `products`: `slug`, `currency`, `image_url`, `is_featured`, `seo_title`, `seo_description`
- `tours`: `image_url`, `is_featured`, `seo_title`, `seo_description`
- `stays`: `image_url`, `capacity`, `amenities`, `is_featured`, `seo_title`, `seo_description`
- `categories`: `is_active`

`categories.is_active` is acceptable as an optional public taxonomy visibility field. No duplicate category table is created.

## Index Review

The draft uses non-unique indexes only.

All indexes use:

- `create index if not exists`

No index references a column unless that column already exists or is added earlier in the same draft.

## RLS Review

No RLS changes are included.

RLS remains a separate future stage.

## Seed Data Review

No seed data is included.

No data insert statements are included in the draft.

## Alcohol Safety Review

The draft does not:

- touch `alcohol_module_settings`
- add alcohol categories/items
- enable alcohol module
- add alcohol sales/delivery behavior

`ALCOHOL_MODULE_ENABLED=false` remains required.

## Issues Found

No safety issues found in the draft.

No fixes were required.

## Final Review Decision

Decision:

- safe for manual review
- not approved for apply automatically
- future apply requires test project confirmation, backup, manual SQL pre-checks and explicit user approval

## Next Steps Before Applying

1. Complete apply decision checklist.
2. Confirm test Supabase project.
3. Confirm backup/export.
4. Confirm `/food` works before apply.
5. Confirm alcohol module is disabled.
6. Get explicit user approval.

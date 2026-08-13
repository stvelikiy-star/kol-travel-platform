# Stage 19-4 - Minimal Safe Catalog Migration Plan

## Why Minimal Migration

Minimal migration is preferred because:

- existing catalog tables already exist
- `/food` adapter works with `public.menu_items`
- full schema redesign is risky
- additive alignment is safer
- current read pilots and mock fallback should remain stable
- existing seed/test data should be preserved

This document is planning only. It does not create SQL migrations, modify schema files, apply Supabase SQL, implement adapters, wire UI, add writes, add payments/bookings/carts/checkout or enable the alcohol module.

## Migration Principles

Future migrations should be:

- additive first
- no column drops
- no column renames
- no breaking changes to `/food`
- no removal of mock fallback
- no new writes by default
- preserving existing data
- tested in Supabase TEST project first

## Migration Prerequisites

Before any migration:

- manual SQL verification is completed
- table/column results are pasted into `docs/MANUAL_SUPABASE_TABLE_VERIFICATION_RESULTS.md`
- `/food` adapter columns are confirmed
- `categories(title)` join is confirmed
- `partners(title, slug)` join is confirmed
- backup/export plan is documented
- `DATA_SOURCE_MODE=mock` before migration
- `ALCOHOL_MODULE_ENABLED=false`
- `npm run build` passes before migration
- rollback to mock mode is confirmed

## Candidate Additive Fields

Do not claim these fields should be added until manual verification confirms they are missing.

### menu_items

Candidate fields:

- `slug`
- `currency`
- `image_url`
- `is_available`
- `is_featured`
- `seo_title`
- `seo_description`

Preferred approach:

- add nullable/defaulted fields
- keep existing fields
- keep current `/food` adapter working
- update adapter only after migration and seed verification

### tours

Candidate fields:

- `category_id`
- `image_url`
- `is_featured`
- `status`
- `seo_title`
- `seo_description`
- `metadata`

Note:

- if these already exist, do not duplicate them
- adapt future read mapping to actual verified fields

### stays

Candidate fields:

- `category_id`
- `image_url`
- `capacity`
- `amenities`
- `is_featured`
- `status`
- `seo_title`
- `seo_description`
- `metadata`

Note:

- room/availability data may belong in separate read-first tables later

### products

Candidate fields:

- `slug`
- `currency`
- `stock_status`
- `image_url`
- `category_id`
- `is_featured`
- `status`
- `seo_title`
- `seo_description`
- `metadata`

Note:

- no checkout/payment/cart writes are included
- no alcohol products/categories may be introduced

## Index Plan

Potential future indexes:

- `slug`
- `business_id`
- `category_id`
- `status`
- `is_featured`
- `created_at`

Rules:

- add indexes only after confirming columns exist
- avoid redundant indexes
- verify current indexes first

## RLS Plan

Do not implement RLS changes in this stage.

Plan later:

- public can read active catalog items
- partners can write own `business_id` items
- admin can moderate
- audit for high-risk/admin changes
- service role remains server-side only

RLS updates should be tested separately from schema column additions.

## Seed Plan

After migration only:

- add safe demo data
- no private data
- no real customer/partner secrets
- no alcohol
- use existing demo partner where possible
- keep stable UUIDs and slugs
- verify public active-only reads

Do not create seed SQL in this stage.

## Testing Plan

Before migration:

- run `npm run build`
- set `DATA_SOURCE_MODE=mock`
- verify `/food` works in mock mode
- verify `/food` current Supabase read assumptions from manual SQL results
- confirm `ALCOHOL_MODULE_ENABLED=false`

After migration:

- verify `/food` in mock mode
- verify `/food` in Supabase mode
- verify no writes on page load
- verify no `audit_logs` insert from reads
- verify alcohol settings remain disabled
- run `npm run build`
- document results before any adapter changes

## Rollback Plan

Since the migration should be additive:

- rollback ideally is not needed
- if read behavior breaks, set `DATA_SOURCE_MODE=mock`
- do not drop newly added columns immediately
- preserve data
- keep `/food` adapter fallback available
- investigate in TEST project before production

If a migration itself fails:

- stop in TEST project
- do not continue with seed or RLS changes
- document failure
- restore from backup/export if needed

## No-Write Guarantee

This stage is docs only:

- no SQL migration created
- no DB changes
- no schema files modified
- no adapters implemented
- no UI wired
- no writes added

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- no alcohol categories/items
- no alcohol activation
- no alcohol settings touched
- no alcohol sales/delivery
- client, partner, courier and admin cannot enable alcohol
- AI cannot enable alcohol

## Blockers

Migration remains blocked until:

- manual table verification results are filled
- current `/food` dependencies are confirmed
- table duplication risk is resolved
- RLS state is understood
- seed data safety is verified
- alcohol disabled state is verified

## Recommended Next Stage

Proceed to Stage 19-5 - Manual Supabase Schema Verification Final Audit.

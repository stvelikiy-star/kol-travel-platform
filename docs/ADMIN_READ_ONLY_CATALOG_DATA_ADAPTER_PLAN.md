# Stage 29-3 — Admin Read-Only Catalog Data Adapter Plan

Project: KOL / Issyk-Kul Travel & Delivery Platform.

## Purpose

Define admin read-only catalog data access before implementation.

Goals:

- show global catalog and moderation visibility safely
- prepare admin review screens without mutations
- keep the public read pilot untouched
- avoid writes, SQL, RLS changes, and schema changes

## Future Files To Plan

Do not create these files in this stage. They are future implementation candidates:

- `src/lib/data/admin-catalog-read.ts`
- `src/lib/data/admin-catalog-supabase.ts`
- `src/lib/data/admin-catalog-mock.ts` if needed
- `src/lib/types/admin-catalog.ts` if needed

## Read Pattern

Future pattern:

```text
admin route/page -> admin catalog read wrapper -> mock or Supabase adapter
```

Rules:

- wrapper checks `DATA_SOURCE_MODE`
- mock mode returns safe mock admin catalog data
- Supabase mode performs read-only catalog queries
- fallback returns safe mock/error state
- no writes
- no moderation actions

## Admin Read Functions To Plan

Future functions:

- `getAdminCatalogOverviewReadResult()`
- `getAdminCatalogReviewQueueReadResult()`
- `getAdminFoodCatalogReadResult()`
- `getAdminToursCatalogReadResult()`
- `getAdminStaysCatalogReadResult()`
- `getAdminProductsCatalogReadResult()`
- `getAdminCatalogCategoriesReadResult()`
- `getAdminCatalogSafetyReadResult()`

Each should return:

- mode
- status
- source
- records/items
- counts
- `errorSafeMessage` if needed
- `fallbackUsed`
- moderation summary
- safety summary

## Source Tables

Read-only sources:

- `menu_items`
- `tours`
- `stays`
- `products`
- `shops`
- `categories`
- `partners`
- `partner_profiles` if needed for business context

## Admin Visibility

Admin read-only views may show:

- all catalog records
- all partners/businesses
- categories
- statuses
- safety flags
- moderation queue

Admin read-only views must not:

- approve/reject
- publish/unpublish
- archive
- update categories
- edit partner data
- create audit logs
- mutate any catalog table

## Moderation Queue Planning

Queue can group records by:

- `under_review`
- rejected
- draft if admin-visible later
- unsafe/safety flagged
- unknown status

Display fields:

- entity type
- id
- title
- `business_id`
- business title
- category
- status
- created/updated timestamps
- safety flags

## Admin Read Result Statuses

Plan:

- `mock_mode`
- `supabase_success`
- `fallback_to_mock`
- `auth_missing`
- `admin_role_missing`
- `read_failed`
- `empty_result`
- `server_error`

## Security

Future implementation must:

- check admin role server-side
- never expose service role to client
- avoid raw Supabase errors
- avoid env/secret output
- keep public read pilot unaffected

## Alcohol / Product Safety

Admin read-only views should show product safety flags where relevant:

- `ALCOHOL_MODULE_ENABLED=false`
- no alcohol sales/delivery path
- no alcohol category enablement
- no alcohol settings visibility unless a future compliance flow explicitly needs it
- uncertain alcohol-like products should be clearly flagged for future moderation planning

## No-Write Guarantee

This stage is docs only:

- no adapters implemented
- no UI
- no routes
- no actions
- no SQL
- no database changes


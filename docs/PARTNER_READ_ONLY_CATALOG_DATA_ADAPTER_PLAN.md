# Stage 29-2 — Partner Read-Only Catalog Data Adapter Plan

Project: KOL / Issyk-Kul Travel & Delivery Platform.

## Purpose

Define partner-owned read-only catalog data access before implementation.

Goals:

- show partner-owned catalog records safely
- keep the public read pilot untouched
- avoid writes
- prepare future implementation

## Future Files To Plan

Do not create these files in this stage. They are future implementation candidates:

- `src/lib/data/partner-catalog-read.ts`
- `src/lib/data/partner-catalog-supabase.ts`
- `src/lib/data/partner-catalog-mock.ts` if needed
- `src/lib/types/partner-catalog.ts` if needed

## Read Pattern

Future pattern:

```text
route/page -> partner catalog read wrapper -> mock or Supabase adapter
```

Rules:

- wrapper checks `DATA_SOURCE_MODE`
- mock mode returns safe mock partner catalog data
- Supabase mode resolves partner business ownership
- Supabase mode reads only records for resolved partner `business_id`
- fallback returns safe mock/error state
- no writes

## Ownership Resolution

Use:

- auth user id
- `partner_profiles.user_id`
- `partner_profiles.business_id`
- `partners.id`
- `catalog.business_id`

Do not use:

- `partner_id`

## Partner Read Functions To Plan

Future functions:

- `getPartnerCatalogOverviewReadResult()`
- `getPartnerFoodCatalogReadResult()`
- `getPartnerToursCatalogReadResult()`
- `getPartnerStaysCatalogReadResult()`
- `getPartnerProductsCatalogReadResult()`

Each should return:

- mode
- status
- source
- records/items
- counts
- `errorSafeMessage` if needed
- `fallbackUsed`
- `ownershipResolved`
- `businessId`
- `businessTitle`

## Counts

Plan status counts:

- total
- draft
- under_review
- approved
- published
- active
- rejected
- archived
- unknown

## Source Tables

Food:

- `menu_items where business_id = partner business_id`

Tours:

- `tours where business_id = partner business_id`

Stays:

- `stays where business_id = partner business_id`

Products:

- `products where business_id = partner business_id`
- optionally `shops where business_id = partner business_id`

## Categories

Partner adapter may read categories for display only:

- `categories.id`
- `categories.scope`
- `categories.title`
- `categories.slug`
- `categories.parent_id`
- `categories.sort_order`

No category writes.

## Partner Read Result Statuses

Plan:

- `mock_mode`
- `supabase_success`
- `fallback_to_mock`
- `auth_missing`
- `partner_profile_missing`
- `business_missing`
- `read_failed`
- `empty_result`
- `server_error`

## Security

Future implementation must:

- never expose service role to client
- avoid raw Supabase errors
- avoid env/secret output
- never return another business's catalog records
- keep queries filtered by resolved `business_id`

## Alcohol / Product Safety

For products:

- `ALCOHOL_MODULE_ENABLED=false`
- product list should mark or hide unsafe/alcohol-like items depending on future decision
- partner cannot see alcohol creation capability
- no alcohol sales/delivery path
- no writes

## No-Write Guarantee

This stage is docs only:

- no adapters implemented
- no UI
- no routes
- no actions
- no SQL
- no database changes


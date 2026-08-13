# Stage 33-1 - Partner Read-Only Adapter Ownership Hardening Implementation

## Files Changed

- `src/lib/types/partner-catalog.ts`
- `src/lib/data/partner-catalog-supabase.ts`
- `src/components/partner/PartnerCatalogModeBadge.tsx`

## Ownership Resolver Behavior

The partner Supabase adapter now resolves a safe partner business context before catalog reads.

Current auth limitation:

- Real Supabase Auth is not connected yet.
- The resolver uses the seeded demo business id as the read-only pilot context.
- Every partner catalog query remains filtered by the resolved `business_id`.
- The resolver returns safe states instead of raw Supabase errors.

## Canonical Relationship

Documented and preserved:

- `partner_profiles.business_id = partners.id`
- `catalog.business_id = partners.id`

No `partner_id` assumption was introduced.

## Business ID Filtering

Partner catalog Supabase reads use only resolved `business.businessId`:

- `menu_items.business_id = business.businessId`
- `tours.business_id = business.businessId`
- `stays.business_id = business.businessId`
- `products.business_id = business.businessId`

Rows are also filtered after read as a defensive guard.

## Failure States

Supported safe states:

- `auth_missing`
- `partner_profile_missing`
- `business_missing`
- `business_inactive`
- `ownership_mismatch`
- `read_failed`
- `empty_result`
- `fallback_to_mock`
- `server_error`
- `mock_mode`
- `supabase_success`

## Fallback Behavior

If Supabase config, business context, or read operation fails:

- No unfiltered catalog read is performed.
- No raw error is returned to UI.
- No secret or env value is returned.
- Read wrappers can fall back to mock data with safe status.

## Alcohol Safety

- `ALCOHOL_MODULE_ENABLED=false`
- Product safety flags remain read-only.
- No alcohol sales/delivery path was added.
- No alcohol override was added.

## No-Write Confirmation

This stage added no writes, forms, server actions, SQL, RLS policies, schema changes, or database changes.

## Test Notes

Stage 33 QA should verify:

- Mock mode still renders partner routes.
- Supabase mode either reads only filtered business records or safely falls back.
- No other business data is intentionally shown.
- No writes occur.

## Next Stage

Stage 33-2 - Admin Read-Only Adapter Role Safe-State Hardening Implementation.

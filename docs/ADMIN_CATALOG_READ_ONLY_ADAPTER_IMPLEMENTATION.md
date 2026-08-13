# Stage 30-3 - Admin Catalog Read-Only Data Adapter Implementation

## Summary

Stage 30-3 added read-only admin catalog adapters for moderation visibility across food, tours, stays, products, categories, review queue, and safety flags.

## Files

- `src/lib/types/admin-catalog.ts`
- `src/lib/data/admin-catalog-mock.ts`
- `src/lib/data/admin-catalog-supabase.ts`
- `src/lib/data/admin-catalog-read.ts`

## Behavior

- `DATA_SOURCE_MODE=mock` returns existing mock catalog data.
- `DATA_SOURCE_MODE=supabase` attempts controlled read-only Supabase reads.
- Failed Supabase reads fall back to mock data.
- Admin catalog reads are visibility-only and do not approve, reject, publish, archive, or mutate records.
- Catalog relationships use `business_id = partners.id`.

## Safety

- No SQL was applied.
- No schema files were changed.
- No server actions or backend writes were added.
- No cart, checkout, payment, order, booking, availability, stock, or audit writes were added.
- Supabase calls are GET-only.

## Alcohol

Product safety flags are read-only. `ALCOHOL_MODULE_ENABLED=false` remains required and alcohol settings are not touched.

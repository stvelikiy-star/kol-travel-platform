# Stage 30-1 - Partner Catalog Read-Only Data Adapter Implementation

## Summary

Stage 30-1 added read-only partner catalog data adapters for food, tours, stays, and products.

## Files

- `src/lib/types/partner-catalog.ts`
- `src/lib/data/catalog-safety.ts`
- `src/lib/data/catalog-read-utils.ts`
- `src/lib/data/partner-catalog-mock.ts`
- `src/lib/data/partner-catalog-supabase.ts`
- `src/lib/data/partner-catalog-read.ts`

## Behavior

- `DATA_SOURCE_MODE=mock` returns existing mock catalog data.
- `DATA_SOURCE_MODE=supabase` attempts controlled read-only Supabase catalog reads.
- Failed Supabase reads fall back to mock data.
- Partner catalog reads use `business_id`, not `partner_id`.
- Supabase reads are GET-only and do not call insert, update, delete, upsert, or write RPC.

## Safety

- No SQL was applied.
- No schema files were changed.
- No server actions or backend writes were added.
- No cart, checkout, payment, order, booking, availability, stock, or audit writes were added.
- `ALCOHOL_MODULE_ENABLED=false` remains required.
- Alcohol-related product safety flags are read-only.

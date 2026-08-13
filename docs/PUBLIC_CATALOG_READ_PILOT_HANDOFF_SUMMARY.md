# Stage 27-4 — Public Catalog Read Pilot Handoff Summary

Project: KOL / Issyk-Kul Travel & Delivery Platform.

## Executive Summary

The public catalog read pilot is complete.

- `/food`, `/tours`, `/stays`, and `/shop` support controlled read mode.
- `DATA_SOURCE_MODE=mock` remains the default.
- Supabase mode is test-only.
- No DB/schema changes were applied.
- No writes were added.
- Alcohol remains disabled.

## Routes

| Route | Data table | Adapter / wrapper | Mock behavior | Supabase behavior | Fallback behavior | Labels | Known limitations |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/food` | `menu_items` | `public-catalog-supabase.ts`, `public-catalog-read.ts` | returns mock food | reads `menu_items` | fallback to mock | `Mock data mode`, `Supabase read pilot`, `Fallback to mock data` | current fields are enough for pilot |
| `/tours` | `tours` | `public-tours-supabase.ts`, `public-tours-read.ts` | returns mock tours | reads `tours` | fallback to mock | `Mock data mode`, `Supabase read pilot`, `Fallback to mock data` | image/SEO fallbacks remain |
| `/stays` | `stays` | `public-stays-supabase.ts`, `public-stays-read.ts` | returns mock stays | reads `stays` | fallback to mock | `Mock data mode`, `Supabase read pilot`, `Fallback to mock data` | image/capacity/amenities/SEO fallbacks remain |
| `/shop` | `products` / `shops` | `public-shop-supabase.ts`, `public-shop-read.ts` | returns mock products | reads safe products | fallback to mock | `Mock data mode`, `Supabase read pilot`, `Fallback to mock data`, `Safety filtered` | slug/currency/image fallbacks; conservative alcohol filtering |

## Safety Summary

The public catalog read pilot adds no:

- writes
- orders
- bookings
- carts
- checkout
- payments
- stock updates
- availability updates
- audit inserts
- SQL
- schema changes
- alcohol enablement

## Environment Summary

- `DATA_SOURCE_MODE=mock` is the default.
- `DATA_SOURCE_MODE=supabase` is for manual testing only.
- `ALCOHOL_MODULE_ENABLED=false`.
- Supabase credentials are required for Supabase mode.
- Do not expose secrets.

## Stage References

- Stage 17: `/food` read pilot
- Stage 22: `/tours` read pilot
- Stage 23: `/stays` read pilot
- Stage 24: `/shop` read pilot and safety filtering
- Stage 25: public catalog read mode consolidation
- Stage 26: manual mock/Supabase mode testing
- Stage 27: public catalog read pilot finalization

## Known Limitations

- limited seed data
- `image_url` missing for some domains
- `/shop` slug/currency fields missing
- SEO fields missing
- RLS production review pending
- management UI not built
- writes not enabled
- Stage 21 migration draft remains unapplied

## Next Recommended Stage

Recommended next stage:

```text
Stage 28 — Partner/Admin Catalog Management Planning
```

Purpose:

- define how partners/admin will create and edit catalog records
- define approval workflow
- define safe write boundaries
- define RLS/write policy requirements
- decide if additive migration is needed before implementation


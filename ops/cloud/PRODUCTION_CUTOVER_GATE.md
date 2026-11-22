# KÖL — managed Supabase Production cutover gate (2026-11-23)

**Current target:** Vercel + isolated managed Supabase project `sggajelagfonzpovnsiz`. The 2026-10-26 Ubuntu-as-Production plan is **superseded for the current launch**, but preserved unchanged for historical reference. Ubuntu is not the primary KÖL production database.

## Verified evidence

- Clean separate Production Supabase, active PostgreSQL 17, public schema 72 tables; 1 confirmed owner/SUPER ADMIN, 0 published stays/tours/products/partners.
- Client-side authenticated SUPER ADMIN session was observed; preview routes `/owner/analytics` and `/admin/catalog` were requested after sign-in.
- Latest completed QA CI `4067a7d00bd9120de6472546936253b44846f613`: 13/13 success (new gating commits must independently repeat checks).
- Production deployment `dpl_7FjyFLq7iP8KMPrNcug2g6Kx63cc` proved the private service key against the **intended Production** via a read-only database request. No secret or record values were printed.
- Production **remains blocked**: source implementation gate and env `KOL_PRODUCTION_RUNTIME_READY` are false.

## Required before enabling customer traffic

1. One real protected cloud JWT/E2E for CLIENT, PARTNER, COURIER and ADMIN against an isolated environment, checking cross-role denial. Owner login alone is not sufficient.
2. Independently restorable encrypted backup of the actual intended Production schema and identity/role data, or equivalent verifiable recovery proof.
3. A real controlled public-intake request through the server adapter, status/readback and idempotency check, with any QA-only test record removed by exact ID.
4. Latest release SHA passes all required CI; site never falls back to mock; service-key probe passes; no guest or banking flows promise unsupported settlement.
5. DNS and HTTPS can be cut over without losing mail records, old site data, or another project's configuration. Until then test with separate URLs.

**Initial release scope:** Manual confirmation of customer requests; empty catalog is legitimate. Online banking/automatic refunds and public self-registration that requires SMTP must remain clearly unavailable until configured. Do not fabricate inventory or accept unverified bank payments.

The machine-readable evidence decision in `ops/cloud/PRODUCTION_CUTOVER_GATE.json` is deliberately **hold** until the remaining steps are verified. Changing it to `go` without real evidence would be unsafe.

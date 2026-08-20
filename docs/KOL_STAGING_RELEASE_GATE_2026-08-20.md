# KÖL — Staging / Release Gate

**Prepared:** 2026-08-20  
**State:** source-only; no Vercel project/deployment created by this change

## Deployment environments

### Development

- `KOL_DEPLOYMENT_ENV=development` or unset
- `DATA_SOURCE_MODE=mock` is allowed
- alcohol must remain disabled

### Preview

- `VERCEL_ENV=preview`
- mock is allowed for UI/source smoke
- Supabase mode is allowed only when the environment points to a dedicated staging project
- production DB must not be used as an ad-hoc preview backend

### Production

Hard fail unless:

- `DATA_SOURCE_MODE=supabase`
- Supabase public URL exists
- publishable/anon public key exists
- `ALCOHOL_MODULE_ENABLED` is not true

The middleware returns 503 when the safety snapshot is unsafe.

## Health endpoint

`GET /api/health`

Returns only non-secret readiness metadata:

- status
- environment
- data source mode
- whether Supabase public config is present
- alcohol enabled flag
- safe failure reason
- short Vercel Git commit SHA when available

No token, key, database password or full environment value is returned.

## Local/CI preflight

`npm run check:deployment-env`

Verified scenarios during preparation:

1. development + mock + alcohol off => PASS
2. production + mock => FAIL
3. production + Supabase public config => PASS
4. secret-like `NEXT_PUBLIC_*` variable => FAIL

The checker prints presence/state only and never prints secret values.

## Current PR/migration dependency order

Source integration order before a real staging Supabase apply:

1. PR #13 — security/RLS baseline (`005`, `006`)
2. PR #19 — Storage/media (`009`) depends on #13
3. PR #15 — Stay/Tour transaction core (`007`)
4. PR #18 — Food/Shop transaction core (`008`) depends on #15
5. PR #14 — production fail-closed data-source guard
6. this staging-readiness branch depends on #14

Before applying SQL in any environment, reconcile these drafts into one reviewed migration sequence from the accepted live-schema baseline; do not fabricate historical Supabase migration timestamps.

## Staging acceptance gate

A real staging deployment is accepted only when all applicable checks are proven:

- locked dependency install
- lint
- TypeScript
- Next build
- deployment-env preflight
- `/api/health` = 200 and expected mode
- RLS role matrix
- cross-partner isolation
- Stay concurrency/no-overbooking
- Tour concurrency/capacity
- Shop stock concurrency
- Food server-side pricing
- media upload/read/delete isolation
- backup/rollback rehearsal
- no production secrets in preview source/logs

## Production gate

Preview success is not production approval. Production still requires explicit owner approval after staging E2E, backup/rollback, payment/business-rule and observability gates.

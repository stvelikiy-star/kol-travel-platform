# KÖL — Staging / Release Gate V2

Prepared: 2026-08-20

## Current state

Source-only readiness layer. No KÖL Vercel project/deployment/domain exists yet. No Supabase development branch was created, no live SQL was applied, and no production traffic was changed.

## Environment contract

### Development
- `KOL_DEPLOYMENT_ENV=development` or unset
- intentional `DATA_SOURCE_MODE=mock` is allowed
- alcohol must remain disabled

### Preview
- `VERCEL_ENV=preview` or `KOL_DEPLOYMENT_ENV=preview`
- mock is allowed only for intentional UI/source smoke
- Supabase mode may point only to a dedicated staging project/branch
- production Supabase must not be used as an ad-hoc preview backend

### Production
Fail closed unless:
- `DATA_SOURCE_MODE=supabase`
- public Supabase URL is present
- publishable/anon public key is present
- alcohol module is disabled

Unsafe non-health requests return generic HTTP 503 with `Cache-Control: no-store`.

## Health endpoint

`GET /api/health` remains reachable even when deployment safety is blocked. It returns 200 when the environment contract is safe and 503 otherwise.

Safe fields only:
- service/status
- environment
- data-source mode
- Supabase public-config presence
- `databaseConnectivity: not_checked`
- alcohol enabled flag
- safe failure reason
- short deployment commit when provided by Vercel
- request correlation id

No token, cookie, user data, database password, service-role value, provider payload or full environment value is returned.

## Request correlation

`x-request-id` is preserved only when it matches a conservative character/length contract; otherwise a new UUID is generated. The id is forwarded into the request and echoed on the response, including blocked 503 responses and health.

## Machine preflight

`npm run check:deployment-env` validates one environment without printing secret values.

`npm run check:deployment-env:selftest` proves five required scenarios:
1. development + mock + alcohol off => PASS
2. production + mock => FAIL
3. production + Supabase public config => PASS
4. alcohol enabled => FAIL
5. secret-like `NEXT_PUBLIC_*SERVICE_ROLE*` key => FAIL

These checks run in GitHub CI before lint/typecheck/build.

## Staging acceptance gate

A real staging environment is accepted only after:
- fresh logical DB backup/export and accepted schema baseline
- dedicated staging Supabase target
- exact source commit identified
- locked dependency install + production dependency audit
- schema manifest + deployment preflight
- lint + TypeScript + Next build
- health endpoint reports expected environment/mode
- RLS role matrix and cross-tenant isolation
- Stay/Tour concurrency tests
- Food/Shop stock/pricing/idempotency tests
- Storage bucket/API/RLS/signed-read tests
- Payment replay/amount/projection tests without real provider activation
- Delivery lifecycle/assignment/role consistency tests
- advisors reviewed
- rollback rehearsal completed

## Production gate

Staging success is not production approval. Production remains blocked until business/payment rules, provider secrets/integration, backup/rollback targets and explicit owner production approval are complete.

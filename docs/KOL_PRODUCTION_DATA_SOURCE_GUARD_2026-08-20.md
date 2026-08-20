# KÖL — Production Data Source Safety Gate

**Prepared:** 2026-08-20

## Risk found

The application intentionally defaults `DATA_SOURCE_MODE` to `mock` for recovery/development. Auth route protection is enabled only in Supabase mode. Before this patch, a production deployment with a missing/incorrect `DATA_SOURCE_MODE` could therefore serve the application in mock mode instead of failing closed.

## Guard

`src/middleware.ts` now treats a deployment as production when either:

- `VERCEL_ENV=production`, or
- `KOL_DEPLOYMENT_ENV=production` for non-Vercel hosting.

For such a deployment the app returns HTTP **503** unless both conditions are true:

1. `DATA_SOURCE_MODE=supabase`;
2. Supabase public runtime configuration has both URL and a public/publishable key.

The response is intentionally generic and `Cache-Control: no-store`.

## Preview/development behavior

Development and Vercel preview environments may continue to use intentional mock mode. This preserves the recovered design/build workflow while preventing an accidental public production launch backed by demo/mock state.

## Scope

This patch does not:

- change data adapters;
- change Supabase RLS;
- change Auth users;
- access secrets;
- deploy the site;
- make any database mutation.

## Deployment contract

Before future production deploy, minimum required environment contract is:

```text
DATA_SOURCE_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=<project URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
```

A legacy public anon key remains supported by the current runtime config, but new deployment setup should prefer the publishable key.

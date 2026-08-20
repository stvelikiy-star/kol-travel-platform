# KÖL — CI Baseline

**Prepared:** 2026-08-20

The recovery repository previously had no `.github/workflows` CI baseline. This branch adds a non-deploying verification workflow for pull requests targeting `main`.

Checks:

- locked install: `npm ci`
- recovered Supabase schema-file presence: `npm run check:supabase-schema-files`
- lint: `npm run lint`
- TypeScript: `npx tsc --noEmit --incremental false`
- production build in intentional `DATA_SOURCE_MODE=mock`: `npm run build`

The workflow does not use production secrets, does not connect to Supabase, does not mutate a database, and does not deploy.

A future staging workflow may add live integration/RLS checks only after a safe staging database and environment contract exist.

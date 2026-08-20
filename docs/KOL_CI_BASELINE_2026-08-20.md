# KÖL — CI Baseline

**Updated:** 2026-08-20  
**Current main runtime:** Next.js 16.3.1 / React 19.2 / Node 22

The repository now has a deterministic, non-deploying CI baseline on `main`.

Required checks:

- locked install: `npm ci`
- production dependency audit: `npm audit --omit=dev --audit-level=high`
- recovered Supabase schema-file presence: `npm run check:supabase-schema-files`
- ESLint CLI: `npm run lint`
- TypeScript: `npx tsc --noEmit --incremental false`
- production build in intentional `DATA_SOURCE_MODE=mock`: `npm run build`

The workflow does not use production secrets, connect to Supabase, mutate a database, or deploy.

The RLS security-v2 restack deliberately does not replace the current CI workflow or ESLint configuration. Live integration/RLS execution remains blocked until a safe staging database and backup/migration baseline exist.

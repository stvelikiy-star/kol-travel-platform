# Stage 12T-1 - Supabase Server Client Implementation Notes

Project: KOL / Issyk-Kul Travel & Delivery Platform.

This stage implemented a safe Supabase client structure only. It did not connect a real Supabase project, add real writes, implement auth helpers, implement audit helper, protect routes, wire UI actions, or mutate mock data.

## Files Created Or Updated

- `src/lib/supabase/errors.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/index.ts`
- `.env.example`
- `README.md`

`src/lib/supabase/admin.ts` was not created because service role access is not needed for the current safe structure.

## Server, Client, And Admin Boundaries

`src/lib/supabase/client.ts` is a browser/public helper placeholder. It checks only:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

It never reads or exposes `SUPABASE_SERVICE_ROLE_KEY`.

`src/lib/supabase/server.ts` is a server-side helper placeholder for future auth/RLS flows. It performs safe config checks and does not create a real Supabase client or perform writes.

`src/lib/supabase/admin.ts` is intentionally not present. If service role access is needed later, it must be added as server-only code and documented separately.

## Safe Errors

`src/lib/supabase/errors.ts` provides safe error helpers:

- `createSupabaseNotConfiguredError()`
- `createSupabaseServerError()`
- `createSupabaseClientError()`

These helpers return safe codes and messages only. They do not expose raw Supabase errors, SQL details, env values, tokens, or service role keys.

## Environment Variables

`.env.example` keeps placeholders only:

- `NEXT_PUBLIC_SUPABASE_URL=`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=`
- `SUPABASE_SERVICE_ROLE_KEY=`
- `DATA_SOURCE_MODE=mock`
- `ALCOHOL_MODULE_ENABLED=false`

Real `.env.local` values must never be committed.

## Service Role Policy

- `SUPABASE_SERVICE_ROLE_KEY` is server-only.
- It must never be imported into client components.
- It should be avoided for the first real partner write.
- It must not be used to bypass partner/courier/client ownership checks.
- Any future service role use must be documented, audited, and isolated to server-only maintenance/admin flows.

## Mock Mode Compatibility

- `DATA_SOURCE_MODE=mock` remains default.
- Current public pages and dashboards continue to build without real Supabase env.
- Demo actions remain available.
- No route protection was added.
- No real database writes were added.

## Rollback Path

If future Supabase client work breaks the app:

1. Keep `DATA_SOURCE_MODE=mock`.
2. Remove accidental Supabase imports from UI pages.
3. Keep demo actions and mock data.
4. Run `npm run build`.
5. Restart the dev server.

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Supabase client helpers must not enable alcohol module.
- Alcohol sales/delivery disabled.
- AI cannot enable alcohol module.
- Partner/courier/admin cannot enable alcohol.
- Super admin cannot activate alcohol without legal review, licensing, and partner verification.


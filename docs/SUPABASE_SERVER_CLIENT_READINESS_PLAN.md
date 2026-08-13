# Stage 12S-1 - Supabase Server Client Readiness Plan

Project: KOL / Issyk-Kul Travel & Delivery Platform.

This document prepares the future Supabase server client implementation. It does not connect Supabase, create real backend writes, implement server client logic, protect routes, wire real actions, or mutate mock data.

## 1. Goal

- Prepare safe Supabase server client implementation.
- Prevent service role key exposure.
- Support future auth helpers.
- Support future audit helper.
- Support the first real write pilot later.

## 2. Current State

- App works in mock mode.
- Supabase planning docs exist.
- Database schema drafts exist.
- Real write is not implemented.
- Real auth is not implemented.
- Real audit writes are not implemented.

## 3. Future Server Client Purpose

The server client will be used by:

- server actions;
- auth helpers;
- role helpers;
- ownership helpers;
- audit helper;
- future real write actions.

The server client must not be used directly in:

- client components;
- browser event handlers;
- public unauthenticated write paths.

## 4. Environment Variables Readiness

Future environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` only if needed server-side
- `DATA_SOURCE_MODE`
- `ALCOHOL_MODULE_ENABLED`

Rules:

- Service role key must never be exposed to the client.
- `.env.local` must never be committed.
- Mock build should not require real Supabase env unless intentionally changed later.
- `DATA_SOURCE_MODE=mock` remains default.

## 5. Future File Inspection

Inspect later:

- `src/lib/supabase/*`
- `src/lib/data/data-source.ts`
- `src/lib/data/*`
- `.env.example`
- `docs/ENVIRONMENT_VARIABLES.md`
- `docs/SUPABASE_ENV_READINESS.md`

Do not modify these files during this stage unless only README/docs update is required.

## 6. Future Server Client File Plan

Possible future files:

- `src/lib/supabase/server.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/admin.ts` only if service role is required
- `src/lib/supabase/types.ts`
- `src/lib/supabase/errors.ts`

Do not create them during this readiness stage.

## 7. Server Client Safety Rules

Future implementation must:

- be server-only where needed;
- avoid importing service role into the client bundle;
- return safe errors;
- not expose raw Supabase errors to UI;
- support RLS;
- support user-session based access;
- avoid bypassing RLS unless explicitly required and audited.

## 8. Service Role Policy

- Service role should be avoided for normal user actions.
- User-scoped server client is preferred for RLS-protected actions.
- Service role may be used only for admin/server-only maintenance flows later.
- Service role usage must be documented and audited.
- Service role must not be used to bypass partner/courier/client ownership checks.

## 9. Mock Mode Compatibility

Future implementation must keep:

- `DATA_SOURCE_MODE=mock` working;
- public pages working without Supabase env if the current project supports that;
- demo dashboards working;
- demo actions available;
- build passing in mock mode.

## 10. Future Readiness Checklist

| Item | Status | Notes |
| --- | --- | --- |
| Supabase URL known | Pending | Must be provided only for test project later. |
| Anon key known | Pending | Public anon key only. |
| Service role key stored only in `.env.local` if needed | Pending | Never commit or expose to browser. |
| `.env.example` documents variables without secrets | Ready | Existing placeholders should remain secret-free. |
| Server client file exists | Pending | Implement later. |
| Client file does not expose secrets | Pending | Verify during implementation. |
| Admin/service client is server-only | Pending | Create only if needed. |
| Mock mode still builds | Ready | Must remain true after future changes. |
| No route protection added accidentally | Ready | This stage does not add protection. |
| No real writes added accidentally | Ready | This stage is docs-only. |

## 11. Dependency For Auth

Auth helpers later need:

- server-side session read;
- profile query;
- role query;
- active/blocked profile check.

## 12. Dependency For Audit

Audit helper later needs:

- server-side database insert;
- `audit_logs` table;
- safe error handling;
- sanitized before/after state.

## 13. Dependency For First Real Write

`markOrderReadyForPickupAction` later needs:

- server-side Supabase access;
- auth user;
- partner profile;
- partner order ownership;
- order update;
- audit insert.

## 14. What Must Not Happen

This stage must not:

- implement real writes;
- implement auth;
- protect routes;
- mutate mock data;
- connect UI buttons to real actions;
- commit secrets;
- enable alcohol module.

## 15. Rollback

If future Supabase client implementation breaks:

- keep `DATA_SOURCE_MODE=mock`;
- remove accidental real client usage from pages;
- keep demo actions;
- keep mock data;
- run `npm run build`;
- restart dev server.

## 16. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Supabase server client must not enable alcohol module.
- Alcohol sales/delivery disabled.
- AI cannot enable alcohol module.
- Partner/courier/admin cannot enable alcohol.
- Super admin cannot activate alcohol without legal review, licensing, and partner verification.
- Alcohol-related request is critical risk.

## 17. Next Stages

- Stage 12S-2 - Supabase Server Client Implementation Prompt Draft
- Stage 12S-3 - Auth Helper Implementation Readiness
- Stage 12S-4 - Audit Helper Implementation Readiness
- Stage 12S-5 - Test Users + RLS Verification Plan
- Then return to Stage 12R real write implementation


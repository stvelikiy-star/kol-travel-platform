# Stage 12S-2 - Supabase Server Client Implementation Prompt Draft

Project: KOL / Issyk-Kul Travel & Delivery Platform.

This document is a future Codex prompt draft for implementing the Supabase server client safely. It is planning only: do not implement the server client, connect Supabase, create backend writes, implement auth/audit, protect routes, wire real actions, or mutate mock data in this stage.

## Future Codex Prompt

Implement the Supabase client structure for KOL with strict server/client boundaries and mock-mode safety.

## 1. Pre-Implementation Requirements

Before coding, confirm:

- Supabase test project exists.
- `NEXT_PUBLIC_SUPABASE_URL` is available in `.env.local`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is available in `.env.local`.
- `SUPABASE_SERVICE_ROLE_KEY` is available only if truly needed.
- `.env.local` is not committed.
- `.env.example` contains placeholder variables only.
- Mock mode still builds.
- Rollback path is ready.

## 2. Future Implementation Goal

- Create safe Supabase client structure.
- Support server-side auth helpers later.
- Support audit helper later.
- Support first real write pilot later.
- Keep `DATA_SOURCE_MODE=mock` working.
- Avoid service role exposure.

## 3. Future Files To Inspect Before Coding

- `src/lib/supabase/*`
- `src/lib/data/data-source.ts`
- `src/lib/data/*`
- `src/types/database.ts`
- `.env.example`
- `docs/ENVIRONMENT_VARIABLES.md`
- `docs/SUPABASE_ENV_READINESS.md`
- `docs/SUPABASE_SERVER_CLIENT_READINESS_PLAN.md`

## 4. Future Files To Create Or Update

Possible files:

- `src/lib/supabase/server.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/admin.ts` only if service role is required
- `src/lib/supabase/errors.ts`
- `src/lib/supabase/index.ts`
- `.env.example`
- `docs/SUPABASE_SERVER_CLIENT_IMPLEMENTATION_NOTES.md`
- `README.md`

## 5. `server.ts` Requirements

Future server client must:

- be usable only from server-side code;
- use Supabase anon key with user session where possible;
- support RLS;
- avoid service role for normal user actions;
- return safe errors;
- not require real env during mock-only build if avoidable.

## 6. `client.ts` Requirements

Future browser/public client must:

- use only `NEXT_PUBLIC_SUPABASE_URL`;
- use only `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
- never use service role key;
- never expose private env values;
- be safe for login/read flows later.

## 7. `admin.ts` Requirements

Create admin/service client only if needed. If created:

- keep it server-only;
- never import it in client components;
- never use it for normal partner/courier/client ownership bypass;
- document every intended use;
- reserve it for admin/server maintenance flows later;
- do not use it to bypass RLS silently.

## 8. `errors.ts` Requirements

Create safe errors:

- `createSupabaseNotConfiguredError()`
- `createSupabaseServerError()`
- `createSupabaseClientError()`

Allowed error codes:

- `supabase_not_configured`
- `supabase_server_error`
- `supabase_client_error`

Rules:

- never expose raw Supabase errors in UI;
- never expose env values;
- never expose SQL details;
- log safely only if needed server-side.

## 9. Environment Rules

`.env.example` should include placeholders only:

- `NEXT_PUBLIC_SUPABASE_URL=`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=`
- `SUPABASE_SERVICE_ROLE_KEY=`
- `DATA_SOURCE_MODE=mock`
- `ALCOHOL_MODULE_ENABLED=false`

Do not commit `.env.local`. Do not commit real keys. Do not hardcode keys in source files.

## 10. Mock Mode Compatibility

Future implementation must ensure:

- `DATA_SOURCE_MODE=mock` remains default;
- `npm run build` passes without real Supabase writes;
- public pages still build;
- dashboards still build;
- demo actions remain available;
- no route protection is accidentally activated.

## 11. Usage Boundaries

Server client may be used later by:

- auth helpers;
- role helpers;
- ownership helpers;
- audit helper;
- server actions;
- future backend wrappers.

Server client must not be used directly by:

- client components for writes;
- browser button handlers for protected writes;
- unauthenticated public write flows.

## 12. Service Role Policy

- Normal user actions should use user-scoped server client and RLS.
- Service role should be avoided for first real write.
- Service role is only for special admin/server maintenance if required later.
- Service role actions require audit and strict server-only isolation.
- Service role must never enable alcohol module.

## 13. Future First Real Write Dependency

`markOrderReadyForPickupAction` later needs:

- server-side Supabase access;
- authenticated partner;
- partner profile;
- partner order ownership;
- order update;
- audit insert;
- safe result.

This stage must not implement that action.

## 14. Future Auth Dependency

Auth helpers later need:

- server-side session read;
- profile query by auth user id;
- role query;
- active/blocked profile check.

This stage must not implement auth helpers.

## 15. Future Audit Dependency

Audit helper later needs:

- safe server-side insert into `audit_logs`;
- sanitized `before_state`/`after_state`;
- safe error handling.

This stage must not implement audit helper.

## 16. Security Checklist

Future implementation must verify:

- no service role key in browser bundle;
- no private env in client code;
- no raw Supabase errors shown in UI;
- no real keys committed;
- no RLS bypass for normal user action;
- no accidental real writes;
- no route protection lockout.

## 17. Rollback

If future implementation breaks:

- keep `DATA_SOURCE_MODE=mock`;
- remove accidental Supabase imports from pages;
- keep demo actions;
- keep mock data;
- run `npm run build`;
- restart dev server.

## 18. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Supabase client must not enable alcohol module.
- Alcohol sales/delivery disabled.
- AI cannot enable alcohol module.
- Partner/courier/admin cannot enable alcohol.
- Super admin cannot activate alcohol without legal review, licensing, and partner verification.
- Alcohol-related request is critical risk.

## 19. Future Tests

Future implementation must run:

```bash
npm run build
```

Also verify:

- mock mode builds;
- no env secret is printed;
- no service key appears in client bundle references;
- demo dashboards still open;
- no real writes are added.

## 20. Next Stages

- Stage 12S-3 - Auth Helper Implementation Readiness
- Stage 12S-4 - Audit Helper Implementation Readiness
- Stage 12S-5 - Test Users + RLS Verification Plan
- Then return to Stage 12R real write implementation


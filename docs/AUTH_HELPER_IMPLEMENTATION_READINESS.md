# Stage 12S-3 - Auth Helper Implementation Readiness

Project: KOL / Issyk-Kul Travel & Delivery Platform.

This document defines readiness for future auth helper implementation. It does not implement auth helpers, connect Supabase Auth, create middleware, protect routes, create backend writes, wire real actions, or mutate mock data.

## 1. Goal

- Confirm what is needed before implementing auth helpers.
- Prevent route lockout.
- Protect future real server actions.
- Prepare partner ownership checks for the first real write.
- Keep mock/demo mode stable.

## 2. Current State

- Supabase server client is not implemented yet.
- Supabase Auth is not connected yet.
- Auth helper planning docs exist.
- Protected route prompt draft exists.
- Test users are planned but not created.
- Real writes are not active.
- `DATA_SOURCE_MODE=mock` remains default.

## 3. Required Docs To Verify

Future implementation should stay consistent with:

- `docs/SUPABASE_AUTH_IMPLEMENTATION_PLAN.md`
- `docs/AUTH_HELPER_FILE_PLAN.md`
- `docs/AUTH_HELPER_IMPLEMENTATION_PROMPT_DRAFT.md`
- `docs/AUTH_TEST_USER_PLAN.md`
- `docs/ROLE_HELPER_PSEUDOCODE.md`
- `docs/PROTECTED_ROUTE_IMPLEMENTATION_PROMPT_DRAFT.md`
- `docs/SUPABASE_SERVER_CLIENT_READINESS_PLAN.md`
- `docs/SUPABASE_SERVER_CLIENT_IMPLEMENTATION_PROMPT_DRAFT.md`

## 4. Future Auth Helper Dependency Checklist

| Dependency | Ready | Not Ready | Unknown | Notes |
| --- | --- | --- | --- | --- |
| Supabase test project exists |  |  | Yes | Must be confirmed outside this repo. |
| Supabase server client exists |  | Yes |  | Planned only. |
| Supabase Auth enabled |  |  | Yes | Must be confirmed in test project. |
| Test users created |  |  | Yes | Planned, not created here. |
| Profile table exists |  |  | Yes | Depends on applied schema. |
| Profile records created |  |  | Yes | Depends on seed/test users. |
| Role field confirmed |  |  | Yes | Must match schema and helpers. |
| Status field confirmed |  |  | Yes | Needed for active/blocked checks. |
| `partner_id` field confirmed |  |  | Yes | Needed for partner ownership. |
| `courier_id` field confirmed |  |  | Yes | Needed for courier access. |
| RLS verified |  |  | Yes | Required before real writes. |
| `.env.local` configured locally |  |  | Yes | Never commit it. |
| `.env.local` not committed | Yes |  |  | Keep this rule. |
| Mock mode still builds | Yes |  |  | Must remain true. |
| Rollback path confirmed | Yes |  |  | Keep demo mode available. |

## 5. Future Auth Helper Files

Future files are planned:

- `src/lib/auth/types.ts`
- `src/lib/auth/errors.ts`
- `src/lib/auth/session.ts`
- `src/lib/auth/profile.ts`
- `src/lib/auth/roles.ts`
- `src/lib/auth/ownership.ts`
- `src/lib/auth/index.ts`

Do not create these files during this readiness stage.

## 6. Future Helper Functions

Auth/session:

- `getCurrentSession()`
- `requireAuthenticatedUser()`

Profile:

- `getCurrentUserProfile()`
- `requireActiveProfile()`

Roles:

- `requireRole(allowedRoles)`
- `requireClient()`
- `requirePartner()`
- `requireCourier()`
- `requireAdmin()`
- `requireSuperAdmin()`

Ownership:

- `requirePartnerOrderOwnership(orderId)`
- `requirePartnerBookingOwnership(bookingId)`
- `requirePartnerCatalogOwnership(itemId)`
- `requirePartnerAvailabilityOwnership(scopeId)`
- `requireCourierDeliveryAccess(deliveryId)`
- `requireClientOrderOwnership(orderId)`
- `requireClientBookingOwnership(bookingId)`

## 7. Required Role Model

Roles must stay consistent:

- `client`
- `partner`
- `courier`
- `admin`
- `super_admin`
- `ai_dispatcher_system`

AI dispatcher:

- server-only;
- not normal browser login;
- cannot approve or execute high-risk actions.

## 8. Protected Routes Dependency

Future route protection must not be enabled until:

- test users exist;
- profile records exist;
- helpers are tested;
- rollback path exists.

Protected route targets:

- `/client/**`
- `/partner/**`
- `/courier/**`
- `/admin/**`

Public pages must stay public.

## 9. First Real Write Dependency

`markOrderReadyForPickupAction(orderId)` later needs:

- authenticated user;
- partner role;
- active partner profile;
- `partner_id` resolved from profile;
- order ownership verified;
- valid status transition;
- audit log created.

## 10. Safe Error Requirements

Future auth helpers must return safe errors:

- `not_authenticated`
- `not_authorized`
- `profile_not_found`
- `profile_inactive`
- `ownership_failed`
- `invalid_role`
- `invalid_target`
- `server_error`

Never expose:

- raw Supabase error;
- SQL details;
- auth token;
- service role key;
- private env values.

## 11. Hard Blocker Rule

Do not implement protected routes or real server actions if these are missing:

- Supabase server client;
- test auth users;
- profile records;
- role helper;
- ownership helper;
- RLS verification;
- rollback path.

## 12. Mock Mode Requirement

Future implementation must keep:

- `DATA_SOURCE_MODE=mock` working;
- demo actions available;
- demo dashboards accessible until auth protection is explicitly enabled;
- `npm run build` passing;
- no Supabase env required for mock-only build if the project supports that.

## 13. Security

- No service role key in client components.
- No raw auth errors in UI.
- Never trust client-provided role.
- Never trust client-provided `partner_id`/`courier_id`.
- Server actions must re-check auth, role, and ownership.
- RLS is still required.

## 14. Rollback

If future auth helper implementation breaks:

- disable route protection first;
- keep `DATA_SOURCE_MODE=mock`;
- keep demo actions;
- keep mock data;
- run `npm run build`;
- restart dev server.

## 15. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Auth helpers must not enable alcohol module.
- Auth roles cannot enable alcohol module.
- AI cannot enable alcohol module.
- Partner/courier/admin cannot enable alcohol.
- Super admin cannot activate alcohol without legal review, licensing, and partner verification.
- Alcohol-related request is critical risk.

## 16. Final Readiness

- Supabase server client readiness: not ready
- Auth users readiness: unknown
- Profile records readiness: unknown
- Role helper readiness: not ready
- Ownership helper readiness: not ready
- Protected route readiness: not ready
- First real write auth readiness: not ready
- Final decision: do not proceed; manual confirmation and dependency implementation required

## 17. Next Stages

- Stage 12S-4 - Audit Helper Implementation Readiness
- Stage 12S-5 - Test Users + RLS Verification Plan
- Stage 12S-6 - Dependency Final Readiness Audit
- Then return to Stage 12R real write implementation


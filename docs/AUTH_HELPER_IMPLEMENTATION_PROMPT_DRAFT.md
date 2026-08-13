# Auth Helper Implementation Prompt Draft

Stage: 12P-4 - Auth Helper Implementation Prompt Draft.

This document contains a future Codex prompt draft for implementing auth helpers later. Do not implement auth helpers now, do not connect Supabase Auth, do not create middleware, do not protect routes, and do not create real backend writes in this stage.

`DATA_SOURCE_MODE=mock` remains the default. `ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## Future Codex Prompt Draft

Use this prompt only after Supabase Auth test users, profile records, schema and RLS are ready.

```text
STAGE 12P-FUTURE - AUTH HELPER IMPLEMENTATION

Project: KOL / Issyk-Kul Travel & Delivery Platform.

Task:
Implement centralized server-side auth helpers for future protected routes and real server actions.

Pre-implementation requirements:

- Supabase test project is ready.
- Supabase Auth test users exist.
- Profile records exist.
- Database schema is applied.
- RLS is verified.
- Supabase server client exists.
- Rollback path is ready.
- Mock mode still works.

Future implementation goal:

- Create centralized server-side auth helpers.
- Support role checks.
- Support ownership checks.
- Support protected routes later.
- Support first real write action later.
- Avoid leaking raw Supabase/auth errors.

Future files to create:

- src/lib/auth/types.ts
- src/lib/auth/errors.ts
- src/lib/auth/session.ts
- src/lib/auth/profile.ts
- src/lib/auth/roles.ts
- src/lib/auth/ownership.ts
- src/lib/auth/index.ts

types.ts:

Define:

- UserRole
- AuthProfile
- SafeAuthError
- AuthHelperResult
- OwnershipCheckResult

Roles:

- client
- partner
- courier
- admin
- super_admin
- ai_dispatcher_system

errors.ts:

Create safe error helpers:

- createAuthError(code, message)
- createNotAuthenticatedError()
- createNotAuthorizedError()
- createProfileNotFoundError()
- createProfileInactiveError()
- createOwnershipError()
- createSafeServerError()

Allowed error codes:

- not_authenticated
- not_authorized
- profile_not_found
- profile_inactive
- ownership_failed
- invalid_role
- invalid_target
- server_error

Never expose raw Supabase errors.

session.ts:

Create server-side helpers:

- getCurrentSession()
- requireAuthenticatedUser()

Responsibilities:

- read server-side user/session
- return safe errors
- no client-only APIs
- no service role exposure
- no raw auth errors in UI

profile.ts:

Create:

- getCurrentUserProfile()
- requireActiveProfile()

Responsibilities:

- load profile by auth_user_id
- return role, partner_id, courier_id, status
- block inactive/blocked profiles
- return safe errors

roles.ts:

Create:

- requireRole(allowedRoles)
- requireClient()
- requirePartner()
- requireCourier()
- requireAdmin()
- requireSuperAdmin()

Rules:

- validate role server-side
- never trust client-provided role
- allow admin/super_admin override only where intentionally designed
- return safe not_authorized error

ownership.ts:

Create:

- requirePartnerOrderOwnership(orderId)
- requirePartnerBookingOwnership(bookingId)
- requirePartnerCatalogOwnership(itemId)
- requirePartnerAvailabilityOwnership(scopeId)
- requireCourierDeliveryAccess(deliveryId)
- requireClientOrderOwnership(orderId)
- requireClientBookingOwnership(bookingId)

Rules:

- validate target ownership server-side
- avoid leaking another user's record existence
- return safe ownership_failed error
- do not use client-provided partner_id/courier_id as source of truth

index.ts:

Export helper functions safely:

- session helpers
- profile helpers
- role helpers
- ownership helpers
- types
- safe errors

Server action usage example:

Future flow for markOrderReadyForPickupAction(orderId):

- requireAuthenticatedUser()
- requirePartner()
- requirePartnerOrderOwnership(orderId)
- validate order status
- perform safe update
- create audit log
- return safe result

Protected route usage example:

Future layout flow:

- get current session
- get current profile
- check role
- redirect if denied
- server actions still re-check role and ownership

Security requirements:

- service role key server-only
- no service role key in client components
- no auth helpers using browser-only APIs unless explicitly client-only
- no raw Supabase/auth errors in UI
- .env.local not committed
- RLS still required
- server-side checks still required

Implementation safety:

- do not break mock mode
- DATA_SOURCE_MODE=mock remains valid
- build must pass without real Supabase env if current project supports mock mode
- if real env is missing, helpers should fail safely only when called
- do not protect routes during helper implementation unless explicitly requested

Alcohol compliance:

- ALCOHOL_MODULE_ENABLED=false
- auth helpers must not enable alcohol module
- auth roles cannot enable alcohol module
- AI cannot enable alcohol module
- partner/courier/admin cannot enable alcohol
- super_admin cannot activate alcohol without legal review, licensing and partner verification
- alcohol-related request is critical risk

Rollback:

- remove route protection first if added
- keep DATA_SOURCE_MODE=mock
- keep demo actions
- keep mock data
- run npm run build
- restart dev server

Future tests:

- npm run build
- typecheck if available
- verify imports do not break
- verify mock pages still open
- later verify each test user role

Final report:

- auth helper files created
- safe error helpers created
- session/profile helpers created
- role helpers created
- ownership helpers created
- mock mode preserved
- build result
- errors if any
```

## 1. Pre-Implementation Requirements

- Supabase test project is ready.
- Supabase Auth test users exist.
- Profile records exist.
- Database schema is applied.
- RLS is verified.
- Supabase server client exists.
- Rollback path is ready.
- Mock mode still works.

## 2. Future Implementation Goal

- Create centralized server-side auth helpers.
- Support role checks.
- Support ownership checks.
- Support protected routes later.
- Support first real write action later.
- Avoid leaking raw Supabase/auth errors.

## 3. Future Files To Create

- `src/lib/auth/types.ts`
- `src/lib/auth/errors.ts`
- `src/lib/auth/session.ts`
- `src/lib/auth/profile.ts`
- `src/lib/auth/roles.ts`
- `src/lib/auth/ownership.ts`
- `src/lib/auth/index.ts`

## 4. Future types.ts

Define:

- `UserRole`
- `AuthProfile`
- `SafeAuthError`
- `AuthHelperResult`
- `OwnershipCheckResult`

Roles:

- `client`
- `partner`
- `courier`
- `admin`
- `super_admin`
- `ai_dispatcher_system`

## 5. Future errors.ts

Create safe error helpers:

- `createAuthError(code, message)`
- `createNotAuthenticatedError()`
- `createNotAuthorizedError()`
- `createProfileNotFoundError()`
- `createProfileInactiveError()`
- `createOwnershipError()`
- `createSafeServerError()`

Allowed error codes:

- `not_authenticated`
- `not_authorized`
- `profile_not_found`
- `profile_inactive`
- `ownership_failed`
- `invalid_role`
- `invalid_target`
- `server_error`

Never expose raw Supabase errors.

## 6. Future session.ts

Create server-side helpers:

- `getCurrentSession()`
- `requireAuthenticatedUser()`

Responsibilities:

- read server-side user/session;
- return safe errors;
- no client-only APIs;
- no service role exposure;
- no raw auth errors in UI.

## 7. Future profile.ts

Create:

- `getCurrentUserProfile()`
- `requireActiveProfile()`

Responsibilities:

- load profile by `auth_user_id`;
- return role, `partner_id`, `courier_id`, status;
- block inactive/blocked profiles;
- return safe errors.

## 8. Future roles.ts

Create:

- `requireRole(allowedRoles)`
- `requireClient()`
- `requirePartner()`
- `requireCourier()`
- `requireAdmin()`
- `requireSuperAdmin()`

Rules:

- validate role server-side;
- never trust client-provided role;
- allow admin/super_admin override only where intentionally designed;
- return safe `not_authorized` error.

## 9. Future ownership.ts

Create:

- `requirePartnerOrderOwnership(orderId)`
- `requirePartnerBookingOwnership(bookingId)`
- `requirePartnerCatalogOwnership(itemId)`
- `requirePartnerAvailabilityOwnership(scopeId)`
- `requireCourierDeliveryAccess(deliveryId)`
- `requireClientOrderOwnership(orderId)`
- `requireClientBookingOwnership(bookingId)`

Rules:

- validate target ownership server-side;
- avoid leaking another user's record existence;
- return safe `ownership_failed` error;
- do not use client-provided `partner_id`/`courier_id` as source of truth.

## 10. Future index.ts

Export helper functions safely:

- session helpers;
- profile helpers;
- role helpers;
- ownership helpers;
- types;
- safe errors.

## 11. Server Action Usage Example

Future flow for `markOrderReadyForPickupAction(orderId)`:

1. `requireAuthenticatedUser()`
2. `requirePartner()`
3. `requirePartnerOrderOwnership(orderId)`
4. Validate order status.
5. Perform safe update.
6. Create audit log.
7. Return safe result.

## 12. Protected Route Usage Example

Future layout flow:

- get current session;
- get current profile;
- check role;
- redirect if denied;
- server actions still re-check role and ownership.

## 13. Security Requirements

- Service role key is server-only.
- No service role key in client components.
- No auth helpers using browser-only APIs unless explicitly client-only.
- No raw Supabase/auth errors in UI.
- `.env.local` not committed.
- RLS still required.
- Server-side checks still required.

## 14. Implementation Safety

- Do not break mock mode.
- `DATA_SOURCE_MODE=mock` remains valid.
- Build must pass without real Supabase env if current project supports mock mode.
- If real env is missing, helpers should fail safely only when called.
- Do not protect routes during helper implementation unless explicitly requested.

## 15. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Auth helpers must not enable alcohol module.
- Auth roles cannot enable alcohol module.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- `super_admin` cannot activate alcohol without legal review, licensing and partner verification.
- Alcohol-related request is critical risk.

## 16. Rollback

If implementation breaks later:

- remove route protection first if added;
- keep `DATA_SOURCE_MODE=mock`;
- keep demo actions;
- keep mock data;
- run `npm run build`;
- restart dev server.

## 17. Future Tests

- `npm run build`
- Typecheck if available.
- Verify imports do not break.
- Verify mock pages still open.
- Later verify each test user role.

## 18. Next Stages

Recommended next stages:

1. `12P-5 Auth + Role Planning Final Audit`
2. `12Q-1 Audit Helper Implementation Plan`
3. `12R-1 First Real Write Pilot Implementation Later`

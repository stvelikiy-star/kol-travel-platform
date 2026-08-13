# Auth Helper File Plan

Stage: 12P-2 - Auth Helper File Plan.

This document plans future auth helper files before implementation. Do not implement auth helpers yet, do not connect Supabase Auth, do not create middleware, and do not create real backend writes in this stage.

`DATA_SOURCE_MODE=mock` remains the default. `ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## 1. Goal

- Plan future auth helper files before implementation.
- Keep auth logic centralized.
- Support role checks.
- Support ownership checks.
- Prepare first real write action later.
- Keep demo/mock mode stable until auth test users exist.

## 2. Current State

- App works in mock mode.
- Auth is not active.
- Demo dashboards are directly accessible.
- Real server actions are not connected.
- Supabase env is not required for build.

## 3. Future Folder Structure

Proposed future files under `src/lib/auth`:

- `src/lib/auth/session.ts`
- `src/lib/auth/profile.ts`
- `src/lib/auth/roles.ts`
- `src/lib/auth/ownership.ts`
- `src/lib/auth/errors.ts`
- `src/lib/auth/types.ts`

Do not create these files now. Document only.

## 4. session.ts Plan

Future helpers:

- `getCurrentSession()`
- `requireAuthenticatedUser()`

Responsibilities:

- Read server-side session.
- Return safe error if no session.
- Never expose raw auth errors.
- Never use browser-only APIs in server helpers.

## 5. profile.ts Plan

Future helpers:

- `getCurrentUserProfile()`
- `requireActiveProfile()`

Responsibilities:

- Load profile by `auth_user_id`.
- Return role, `partner_id`, `courier_id`, status.
- Block suspended/blocked users later.
- Return safe errors.

## 6. roles.ts Plan

Future helpers:

- `requireRole(allowedRoles)`
- `requireClient()`
- `requirePartner()`
- `requireCourier()`
- `requireAdmin()`
- `requireSuperAdmin()`

Responsibilities:

- Validate server-side role.
- Never trust client-only role.
- Support admin/super_admin override where appropriate.
- Return safe not authorized errors.

## 7. ownership.ts Plan

Future helpers:

- `requirePartnerOrderOwnership(orderId)`
- `requirePartnerBookingOwnership(bookingId)`
- `requirePartnerCatalogOwnership(itemId)`
- `requirePartnerAvailabilityOwnership(scopeId)`
- `requireCourierDeliveryAccess(deliveryId)`
- `requireClientOrderOwnership(orderId)`
- `requireClientBookingOwnership(bookingId)`

Responsibilities:

- Verify target record belongs to authenticated role.
- Avoid leaking whether another user's record exists.
- Block cross-partner/cross-courier/cross-client access.

## 8. errors.ts Plan

Future safe error helpers:

- `createAuthError(code, message)`
- `createAuthorizationError()`
- `createOwnershipError()`
- `createSafeServerError()`

Error codes:

- `not_authenticated`
- `not_authorized`
- `profile_not_found`
- `profile_inactive`
- `ownership_failed`
- `invalid_role`
- `server_error`

## 9. types.ts Plan

Future types:

- `UserRole`
- `AuthProfile`
- `AuthResult`
- `SafeAuthError`
- `OwnershipCheckResult`

Roles:

- `client`
- `partner`
- `courier`
- `admin`
- `super_admin`
- `ai_dispatcher_system`

## 10. Server Action Usage Example

Future usage flow for `markOrderReadyForPickupAction`:

1. `requirePartner()`
2. `requirePartnerOrderOwnership(orderId)`
3. Validate order status.
4. Perform safe update.
5. Create audit log.
6. Return safe result.

The server action must re-check role and ownership even if the UI already hides buttons.

## 11. Protected Route Usage Example

Future usage:

- Layout checks role.
- Server actions still re-check role.
- Ownership checks happen in action/query layer.
- RLS still required.
- Wrong-role users receive safe redirects or safe errors.

## 12. Security Rules

- Service role key is server-only.
- No service key in client components.
- No raw Supabase/auth errors in UI.
- No real env required in mock mode.
- RLS remains required.
- Server action checks remain required.

## 13. Rollback

- Keep `DATA_SOURCE_MODE=mock`.
- Keep demo actions.
- Keep mock data.
- Do not enforce auth before test users exist.
- If auth implementation breaks later, rollback route protection first.

## 14. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- Auth helpers must not enable alcohol module.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- `super_admin` cannot activate alcohol without legal review, licensing and partner verification.
- Alcohol-related request is critical risk.

## 15. Next Stages

Recommended next stages:

1. `12P-3 Protected Route Implementation Prompt Draft`
2. `12P-4 Auth Helper Implementation Prompt Draft`
3. `12Q-1 Audit Helper Implementation Plan`
4. `12R-1 First Real Write Pilot Implementation Later`

# Auth + Role Planning Final Audit

Stage: 12P-5 - Auth + Role Planning Final Audit.

This document audits Auth + Role planning before future implementation. Do not implement auth, auth helpers, middleware, protected routes or real backend writes in this stage.

`DATA_SOURCE_MODE=mock` remains the default. `ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## 1. Goal

- Confirm Auth + Role planning is complete.
- Verify consistency between auth plan, helper plan, route protection plan and future real write requirements.
- Identify blockers before implementation.
- Keep mock/demo mode stable.

## 2. Documents Verified

These docs exist and are consistent:

- `docs/SUPABASE_AUTH_IMPLEMENTATION_PLAN.md`
- `docs/AUTH_HELPER_FILE_PLAN.md`
- `docs/PROTECTED_ROUTE_IMPLEMENTATION_PROMPT_DRAFT.md`
- `docs/AUTH_HELPER_IMPLEMENTATION_PROMPT_DRAFT.md`
- `docs/AUTH_TEST_USER_PLAN.md`
- `docs/ROLE_HELPER_PSEUDOCODE.md`
- `docs/PROTECTED_ROUTE_STRATEGY_CHECKLIST.md`
- `docs/AUTH_AND_ROLES_PLAN.md`

## 3. Auth Planning Checklist

Confirmed:

- Test users are planned.
- Profiles are planned.
- Role mapping is planned.
- `partner_id`/`courier_id` ownership mapping is planned.
- Server-side auth helpers are planned.
- Protected route strategy is planned.
- Rollback strategy is planned.
- No auth is implemented yet.

## 4. Role Model Checklist

Roles are consistent:

- `client`
- `partner`
- `courier`
- `admin`
- `super_admin`
- `ai_dispatcher_system`

Confirmed:

- AI dispatcher is server-only.
- AI dispatcher is not normal browser login.
- Admin/super_admin override rules are documented.
- Partner/courier/client ownership restrictions are documented.

## 5. Protected Route Checklist

Future route rules are consistent.

### Public

- `/`
- `/tours`
- `/stays`
- `/food`
- `/shop`
- `/partners`
- `/contacts`
- `/cart`
- `/checkout`
- `/booking/checkout`
- `/order/success`
- `/booking/success`

### Protected: `/client/**`

Allowed:

- `client`
- `admin`
- `super_admin`

### Protected: `/partner/**`

Allowed:

- `partner`
- `admin`
- `super_admin`

### Protected: `/courier/**`

Allowed:

- `courier`
- `admin`
- `super_admin`

### Protected: `/admin/**`

Allowed:

- `admin`
- `super_admin`

## 6. Ownership Checklist

Future ownership helpers are planned:

- `requirePartnerOrderOwnership(orderId)`
- `requirePartnerBookingOwnership(bookingId)`
- `requirePartnerCatalogOwnership(itemId)`
- `requirePartnerAvailabilityOwnership(scopeId)`
- `requireCourierDeliveryAccess(deliveryId)`
- `requireClientOrderOwnership(orderId)`
- `requireClientBookingOwnership(bookingId)`

Ownership checks remain required even when routes are protected.

## 7. First Real Write Readiness

Auth planning supports future:

- `markOrderReadyForPickupAction(orderId)`

Future action will require:

- authenticated user;
- partner role;
- partner order ownership;
- valid order status transition;
- audit log;
- safe result;
- no payment mutation;
- no cancellation/refund mutation;
- no alcohol module changes.

## 8. Security Checklist

Future implementation must enforce:

- no service role key in client components;
- no raw Supabase/auth errors in UI;
- no real credentials in repo;
- no `.env.local` commit;
- RLS still required;
- server action checks still required;
- route protection is not enough without ownership checks.

## 9. Blockers Before Real Implementation

Blockers that must be resolved before real auth implementation:

- Supabase test project must exist.
- SQL schema must be applied.
- RLS must be verified.
- Seed data must be verified.
- Test users must be created.
- Matching profile records must exist.
- Partner/courier ownership records must exist.
- Rollback path must be clear.

## 10. Rollback Confirmation

Confirmed:

- `DATA_SOURCE_MODE=mock` remains default.
- Demo dashboards remain accessible.
- Demo actions remain available.
- Auth protection is not active yet.
- Real writes are not active yet.

## 11. Alcohol Compliance

Confirmed:

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- Auth roles cannot enable alcohol module.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- `super_admin` cannot activate alcohol without legal review, licensing and partner verification.
- Alcohol-related request is critical risk.

## 12. Final Decision

- Auth planning status: complete.
- Protected route planning status: complete.
- Role helper planning status: complete.
- Ownership planning status: complete.
- Ready for Stage 12Q: yes.

This decision means planning is ready to move forward, not that real auth implementation is ready to start without resolving the blockers listed above.

## 13. Next Stages

Recommended next stages:

1. `12Q-1 Audit Helper Implementation Plan`
2. `12Q-2 Audit Helper File Plan`
3. `12Q-3 Audit Helper Implementation Prompt Draft`
4. `12R-1 First Real Write Pilot Implementation Later`

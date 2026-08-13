# Supabase Auth Implementation Plan

Stage: 12P-1 - Supabase Auth Implementation Plan.

This document plans future Supabase Auth integration. Do not implement auth yet, do not connect Supabase Auth, do not create middleware, and do not create real backend writes in this stage.

`DATA_SOURCE_MODE=mock` remains the default. `ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## 1. Goal

- Plan future Supabase Auth integration.
- Keep demo/mock mode stable.
- Prepare protected routes.
- Prepare role/ownership checks.
- Prepare first real write action later.
- Keep development rollback safe while auth is introduced.

## 2. Current State

- App works in mock mode.
- All dashboards are demo-accessible.
- Demo actions exist.
- Real auth is not connected.
- Real writes are not connected.
- Supabase env is not required for build.

## 3. Required Supabase Auth Setup Later

- Create test users.
- Confirm email/password login for test users.
- Create matching profiles records.
- Assign roles.
- Link partner user to `partner_id`.
- Link courier user to `courier_id`.
- Keep admin and `super_admin` separate.
- AI dispatcher is server-only, not browser login.

## 4. Test Users

Use clearly fake test users:

- `client@test.kol`
- `partner@test.kol`
- `courier@test.kol`
- `admin@test.kol`
- `superadmin@test.kol`

Do not store real passwords in docs. Do not use real personal data.

## 5. Profile Requirements Later

Profile should include or map to:

- `id`
- `auth_user_id`
- `role`
- `full_name`
- `email`
- `phone` optional
- `partner_id` optional
- `courier_id` optional
- `status`
- `created_at`
- `updated_at`

Actual fields must be verified against schema before implementation.

## 6. Auth Helper Plan

Future helpers:

- `getCurrentSession()`
- `getCurrentUserProfile()`
- `requireAuthenticatedUser()`
- `requireRole(allowedRoles)`
- `requirePartner()`
- `requireCourier()`
- `requireAdmin()`
- `requireSuperAdmin()`

These helpers must run server-side for real actions and protected route checks.

## 7. Ownership Helper Plan

Future helpers:

- `requirePartnerOrderOwnership(orderId)`
- `requirePartnerBookingOwnership(bookingId)`
- `requirePartnerCatalogOwnership(itemId)`
- `requireCourierDeliveryAccess(deliveryId)`
- `requireClientOrderOwnership(orderId)`

Ownership helpers must hide whether another user's private record exists.

## 8. Protected Route Plan

Later:

- `/client/**` requires `client`, `admin`, or `super_admin`.
- `/partner/**` requires `partner`, `admin`, or `super_admin`.
- `/courier/**` requires `courier`, `admin`, or `super_admin`.
- `/admin/**` requires `admin` or `super_admin`.
- Public catalog pages remain public.

Route access is not enough for mutations; server actions must still verify role and ownership.

## 9. Server Action Protection

Every real server action must:

- verify session;
- verify role;
- verify ownership;
- validate status transition;
- create audit log if required;
- never trust client-side role only.

## 10. Implementation Sequence Later

1. Verify Supabase env locally.
2. Create test users in Supabase test project.
3. Create matching profile records.
4. Implement server-side auth helpers.
5. Test helpers without route protection first.
6. Add protected route strategy.
7. Test role access.
8. Test ownership helpers.
9. Only then implement first real write pilot.

## 11. Development Safety

- Keep `DATA_SOURCE_MODE=mock` until auth is stable.
- Keep demo actions.
- Keep mock data.
- Do not lock yourself out of local development.
- Do not enforce protected routes before test users exist.
- Keep rollback plan.
- Public pages should remain accessible during auth rollout.

## 12. Security Rules

- Never commit `.env.local`.
- Never expose service role key.
- Never import service role key in client components.
- Never show raw auth/Supabase errors in UI.
- RLS must still be active.
- Server-side checks are still required.
- Public anon key is not enough for unsafe writes.

## 13. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- Auth roles cannot enable alcohol module.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- `super_admin` cannot activate alcohol without legal review, licensing and partner verification.
- Alcohol-related request is critical risk.

## 14. Next Stages

Recommended next stages:

1. `12P-2 Auth Helper File Plan`
2. `12P-3 Protected Route Implementation Prompt Draft`
3. `12Q-1 Audit Helper Implementation Plan`
4. `12R-1 First Real Write Pilot Implementation Later`

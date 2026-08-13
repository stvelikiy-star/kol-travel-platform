# Stage 12T-4 - Test Users + RLS Manual Verification Guide

Project: KOL / Issyk-Kul Travel & Delivery Platform.

This guide is documentation only. It does not create Supabase users, apply SQL, modify schema, create backend writes, protect routes, wire real actions, or mutate mock data.

## 1. Goal

- Manually verify Supabase test project before the first real write.
- Verify SQL, RLS, and seed data.
- Verify auth users and profile mappings.
- Verify partner ownership before `markOrderReadyForPickupAction`.

## 2. Test Users To Create Manually Later

Create fake test users only in the Supabase test project:

- `client@test.kol`
- `partner@test.kol`
- `courier@test.kol`
- `admin@test.kol`
- `superadmin@test.kol`

Rules:

- fake emails only;
- no real passwords in docs;
- no credentials committed;
- test project only.

## 3. Required Profile Mappings

Client:

- role `client`;
- active status;
- no `partner_id`;
- no `courier_id`.

Partner:

- role `partner`;
- active status;
- linked `partner_id`;
- must own one test order.

Courier:

- role `courier`;
- active status;
- linked `courier_id`;
- must have assigned test delivery if available.

Admin:

- role `admin`;
- active status.

Super admin:

- role `super_admin`;
- active status.

## 4. Required SQL/RLS Verification

Check:

- profiles table exists;
- orders table exists;
- bookings table exists;
- deliveries table exists if used;
- `audit_logs` table exists;
- `high_risk_approvals` table exists if used later;
- RLS enabled where needed;
- policies prevent cross-role and cross-owner access.

## 5. Partner Ownership Verification For First Real Write

Before `markOrderReadyForPickupAction`:

- `partner@test.kol` can login later;
- partner profile resolves `partner_id`;
- test order has the same `partner_id`;
- test order status is `accepted_by_partner` or `preparing`;
- partner cannot update `payment_status`;
- partner cannot update another partner's order;
- audit insert strategy works.

## 6. RLS Deny Tests

- Client must not access partner/courier/admin private data.
- Partner must not access another partner's orders/catalog/availability.
- Courier must not access another courier's private delivery data.
- Admin must not bypass audit/high-risk rules.
- Normal roles must not enable alcohol module.

## 7. Audit Verification

Audit logs:

- not publicly readable;
- not publicly writable;
- insert only through safe server-side helper later;
- readable by admin/super_admin later if designed.

## 8. Environment Verification

Check local `.env.local` manually:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` only if needed
- `DATA_SOURCE_MODE=mock` by default
- `ALCOHOL_MODULE_ENABLED=false`

Never commit `.env.local`.

## 9. Manual Checklist

| Item | Status: Ready / Not Ready / Unknown | Notes |
| --- | --- | --- |
| Supabase test project exists | Unknown | Verify manually in Supabase. |
| Env configured locally | Unknown | `.env.local` must stay uncommitted. |
| Schema applied | Unknown | Apply only in test project. |
| Seed data applied | Unknown | Use demo/test data only. |
| RLS enabled | Unknown | Verify table by table. |
| RLS deny tests passed | Unknown | Required before real writes. |
| Test users created | Unknown | Fake users only. |
| Profiles created | Unknown | Must map auth user to role/profile. |
| `partner_id` mapping verified | Unknown | Required for partner ownership. |
| `courier_id` mapping verified | Unknown | Required for courier delivery access. |
| Test order exists | Unknown | Required for first real write. |
| Test order belongs to partner | Unknown | Must match `partner@test.kol` profile. |
| `audit_logs` protected | Unknown | Must not be public read/write. |
| Rollback to mock confirmed | Ready | Keep `DATA_SOURCE_MODE=mock`. |
| Build passes | Ready | Re-run after every implementation step. |

## 10. Hard Blocker

Do not implement `markOrderReadyForPickupAction` if any are missing:

- test partner user;
- partner profile;
- `partner_id` mapping;
- owned test order;
- allowed source status;
- RLS deny tests;
- audit helper readiness;
- rollback path.

## 11. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales/delivery disabled.
- Test users cannot enable alcohol module.
- AI cannot enable alcohol module.
- Partner/courier/admin cannot enable alcohol.
- Super admin cannot activate alcohol without legal review, licensing, and partner verification.

## 12. Next Stages

- Stage 12T-5 - Dependency Implementation Final Audit
- Then return to Stage 12R `markOrderReadyForPickupAction` only after manual verification


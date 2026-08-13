# Stage 12S-5 - Test Users + RLS Verification Plan

Project: KOL / Issyk-Kul Travel & Delivery Platform.

This document plans safe verification of Supabase test users and RLS. It does not create users, connect Supabase, apply RLS, create backend writes, implement auth/audit helpers, protect routes, wire real actions, or mutate mock data.

## 1. Goal

- Plan safe verification of Supabase test users.
- Plan profile-role mapping verification.
- Plan RLS verification before real actions.
- Prepare the first real write pilot safely.
- Avoid accidental access between client, partner, courier, and admin data.

## 2. Current State

- Test users are planned.
- Auth helpers are not implemented yet.
- Audit helper is not implemented yet.
- Supabase real connection is not active.
- RLS verification is not performed yet.
- `DATA_SOURCE_MODE=mock` remains default.

## 3. Test Users To Create Later

Use fake test users only:

- `client@test.kol`
- `partner@test.kol`
- `courier@test.kol`
- `admin@test.kol`
- `superadmin@test.kol`

Rules:

- do not use real client data;
- do not store real passwords in docs;
- do not commit credentials;
- use Supabase test project only.

## 4. Required Profile Mapping

Each future test user must have a matching profile record.

Client:

- `role = client`
- `status = active`
- no `partner_id`
- no `courier_id`

Partner:

- `role = partner`
- `status = active`
- linked `partner_id`
- must own at least one demo order;
- must own at least one demo booking/catalog/availability record if available.

Courier:

- `role = courier`
- `status = active`
- linked `courier_id`
- must have at least one assigned demo delivery if available.

Admin:

- `role = admin`
- `status = active`
- no `partner_id` required;
- no `courier_id` required.

Super admin:

- `role = super_admin`
- `status = active`
- no `partner_id` required;
- no `courier_id` required.

## 5. AI Dispatcher

- `ai_dispatcher_system` is not a normal browser login.
- It is a server-only identity later.
- It cannot approve high-risk actions.
- It cannot execute high-risk actions.
- It cannot enable alcohol module.

## 6. RLS Verification Scope

Plan to verify RLS for:

- profiles;
- orders;
- bookings;
- deliveries;
- partner catalog/items;
- partner availability;
- `audit_logs`;
- `high_risk_approvals` if table exists later.

## 7. Client RLS Tests Later

Client should be able to:

- read own profile;
- read own orders;
- read own bookings.

Client should not be able to:

- read another client's orders/bookings;
- read partner private data;
- read courier private data;
- read admin-only data;
- update payment status;
- approve refund;
- enable alcohol module.

## 8. Partner RLS Tests Later

Partner should be able to:

- read own partner profile/data;
- read own orders;
- read own bookings;
- read own catalog items;
- read own availability.

Partner should not be able to:

- read another partner's orders;
- update another partner's catalog;
- access courier private data;
- access admin-only data;
- update `payment_status`;
- approve refund;
- cancel after restricted status without approval flow;
- enable alcohol module.

## 9. Courier RLS Tests Later

Courier should be able to:

- read own courier profile;
- read own assigned deliveries;
- update allowed delivery status later if implemented.

Courier should not be able to:

- read another courier's private data;
- access partner private dashboard data;
- access client private data outside assigned delivery context;
- change order items;
- change payment status;
- cancel order;
- approve refund;
- enable alcohol module.

## 10. Admin RLS Tests Later

Admin should be able to:

- access admin operational views;
- review delivery/order issues;
- review partner/courier moderation views;
- review finance-related records if allowed.

Admin should not be able to:

- bypass audit requirements;
- bypass high-risk approval requirements;
- expose service role key;
- enable alcohol module without legal/super_admin process.

## 11. Super Admin RLS Tests Later

Super admin should be able to:

- access platform-level views;
- manage future roles/settings if implemented;
- review compliance-critical records.

Super admin should not be able to:

- bypass legal/compliance requirements;
- activate alcohol module without legal review, licensing, and partner verification;
- bypass audit log for critical settings later.

## 12. Audit Logs RLS Plan

Audit logs should:

- not be publicly readable;
- not be publicly writable;
- be readable by admin/super_admin later;
- be insertable only through safe server-side flow later;
- not expose secrets or raw private data.

## 13. First Real Write RLS Dependency

Before implementing `markOrderReadyForPickupAction(orderId)`, verify:

- `partner@test.kol` can authenticate;
- partner profile resolves `partner_id`;
- test order belongs to that `partner_id`;
- partner can update allowed order fields through proper server-side flow;
- partner cannot update `payment_status`;
- partner cannot update another partner's order;
- `audit_logs` can be inserted safely.

## 14. Manual Verification Checklist

| Item | Ready | Not Ready | Unknown | Notes |
| --- | --- | --- | --- | --- |
| Supabase test project exists |  |  | Yes | Must be confirmed outside this repo. |
| SQL schema applied |  |  | Yes | Future manual/test project step. |
| Seed data applied |  |  | Yes | Future manual/test project step. |
| Test users created |  |  | Yes | Do not create in this stage. |
| Profile records created |  |  | Yes | Requires test users and schema. |
| `partner_id` mapping verified |  |  | Yes | Required before partner real write. |
| `courier_id` mapping verified |  |  | Yes | Required before courier writes. |
| Client ownership verified |  |  | Yes | Required before client protected reads/writes. |
| Partner ownership verified |  |  | Yes | Required before first real write. |
| Courier assignment verified |  |  | Yes | Required before courier writes. |
| Admin role verified |  |  | Yes | Required before admin actions. |
| Super admin role verified |  |  | Yes | Required before platform settings. |
| RLS policies applied |  |  | Yes | Must be verified in test project. |
| RLS deny tests passed |  |  | Yes | Hard blocker for real writes. |
| `audit_logs` protected |  |  | Yes | Must not be public read/write. |
| Rollback to mock mode confirmed | Yes |  |  | `DATA_SOURCE_MODE=mock` remains default. |
| Build passes | Yes |  |  | Must remain true after changes. |

## 15. Safe Testing Rules

- Use test project only.
- Use fake emails only.
- Do not use real client data.
- Do not use real payment data.
- Do not store real passwords in repo.
- Do not commit `.env.local`.
- Do not expose service role key.
- Do not test on production data.

## 16. Hard Blocker Rule

Do not implement first real write if any are missing:

- test partner user;
- active partner profile;
- `partner_id` mapping;
- owned test order;
- RLS deny tests;
- `audit_logs` access strategy;
- rollback to mock mode.

## 17. Rollback

If RLS/user verification fails:

- do not implement real action;
- keep `DATA_SOURCE_MODE=mock`;
- keep demo actions;
- keep mock data;
- fix schema/RLS/test user mapping first;
- run `npm run build`.

## 18. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales/delivery disabled.
- Test users cannot enable alcohol module.
- RLS tests must confirm normal roles cannot enable alcohol module.
- AI cannot enable alcohol module.
- Partner/courier/admin cannot enable alcohol.
- Super admin cannot activate alcohol without legal review, licensing, and partner verification.
- Alcohol-related request is critical risk.

## 19. Final Verification Decision

- Test users readiness: unknown
- Profile mapping readiness: unknown
- RLS readiness: unknown
- Audit table readiness: unknown
- First real write readiness: not ready
- Final decision: manual confirmation required; do not proceed with real write yet

## 20. Next Stages

- Stage 12S-6 - Dependency Final Readiness Audit
- Then return to Stage 12R real write implementation only if dependencies are ready
- Otherwise implement missing Supabase/Auth/Audit dependencies first


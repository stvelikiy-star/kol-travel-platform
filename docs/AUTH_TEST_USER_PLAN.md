# Auth Test User Plan

Stage: 12M-4 - Auth Test User Plan.

This document plans future Supabase Auth test users. Do not create real users yet, do not connect Supabase Auth, do not implement auth helpers, and do not create middleware in this stage.

`DATA_SOURCE_MODE=mock` remains the default. `ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## 1. Goal

- Plan test users for future Supabase Auth.
- Test role-based access safely.
- Test ownership rules.
- Test protected routes later.
- Keep demo/mock mode stable.

## 2. Test User Roles

Plan these future users:

- test client;
- test partner;
- test courier;
- test admin;
- test `super_admin`.

Optional system identity:

- `ai_dispatcher_system` is server-only, not normal browser login.

## 3. Suggested Test Emails

Use clearly fake test emails:

- `client@test.kol`
- `partner@test.kol`
- `courier@test.kol`
- `admin@test.kol`
- `superadmin@test.kol`

Do not use real client emails or real personal data.

## 4. Test Profile Records Later

Expected profile fields:

- `auth_user_id`
- `role`
- `full_name`
- `phone` optional
- `email`
- `partner_id` optional
- `courier_id` optional
- `status = active`
- `created_at`
- `updated_at`

Actual fields must match schema before implementation.

## 5. Partner Test Data

Future partner user should be linked to:

- one demo partner;
- demo orders belonging to that partner;
- demo bookings belonging to that partner;
- demo catalog items belonging to that partner;
- demo availability rules belonging to that partner.

Test ownership:

- Partner can see own data.
- Partner cannot see another partner data.
- Partner cannot change payment.
- Partner cannot force refund.
- Partner cannot enable alcohol module.

## 6. Courier Test Data

Future courier user should be linked to:

- one demo courier profile;
- assigned demo delivery;
- available demo delivery if allowed;
- delivery issue examples;
- delivery history examples.

Test ownership:

- Courier can see own assigned delivery.
- Courier cannot see another courier private data.
- Courier cannot change payment.
- Courier cannot change order items.
- Courier cannot cancel order.
- Courier cannot enable alcohol module.

## 7. Client Test Data

Future client user should be linked to:

- own demo order;
- own demo booking;
- own loyalty/offers examples if used;
- own support examples if used.

Test ownership:

- Client can see own data only.
- Client cannot access partner/courier/admin.
- Client cannot change payment.
- Client cannot force refund.

## 8. Admin Test Data

Future admin user should test:

- `/admin` access;
- delivery control visibility;
- issue review visibility;
- partner/courier moderation views;
- finance review views;
- high-risk approval warnings.

Admin restrictions:

- High-risk actions require audit later.
- Payment/refund changes require strict approval later.
- Admin cannot bypass legal/compliance flow.
- Admin cannot enable alcohol module without future `super_admin`/legal process.

## 9. Super Admin Test Data

Future `super_admin` user should test:

- platform-level access;
- role management later;
- critical settings later;
- compliance flows later.

Super admin restrictions:

- Cannot bypass legal/licensing requirements.
- Alcohol module remains disabled by default.
- Alcohol activation requires legal review, licensing and partner verification.

## 10. AI Dispatcher System

- Not a normal user login.
- Server-only operational identity later.
- Can create recommendations/alerts/logs.
- Cannot execute high-risk actions.
- Cannot cancel orders.
- Cannot change payment.
- Cannot approve refunds.
- Cannot enable alcohol module.

## 11. Protected Route Test Matrix

Expected access:

| Area | Client | Partner | Courier | Admin | Super Admin |
| --- | --- | --- | --- | --- | --- |
| Public pages | yes | yes | yes | yes | yes |
| `/client` | yes | no | no | yes/support | yes |
| `/partner` | no | yes | no | yes/support | yes |
| `/courier` | no | no | yes | yes/support | yes |
| `/admin` | no | no | no | yes | yes |

## 12. Test Checklist Later

- Create auth users in Supabase test project.
- Create matching profile records.
- Link `partner_id`/`courier_id`.
- Confirm login works.
- Confirm protected routes.
- Confirm ownership checks.
- Confirm wrong-role access is blocked.
- Confirm mock rollback works.

## 13. Safety

- Never use real passwords in docs.
- Never commit test credentials.
- Never commit `.env.local`.
- Service role key is server-only.
- No private env in client components.
- No raw auth errors in UI.
- Do not use real personal data.

## 14. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- Test users cannot enable alcohol module.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- `super_admin` cannot activate alcohol without legal review, licensing and partner verification.
- Alcohol-related request is critical risk.

## 15. Next Stages

Recommended next stages:

1. `12N-1 Audit Log Implementation Plan`
2. `12O-1 First Real Write Implementation Preparation`
3. `12P Supabase Auth Implementation Later`

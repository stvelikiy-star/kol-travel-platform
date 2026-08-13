# Auth + Role Implementation Plan

Stage: 12M-1 - Auth + Role Implementation Plan.

This document plans future Supabase Auth and role integration. Do not implement auth yet, do not connect Supabase Auth, do not create protected routes, and do not connect real writes in this stage.

`DATA_SOURCE_MODE=mock` remains the default. `ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## 1. Goal

- Plan future Supabase Auth integration.
- Define roles and protected route strategy.
- Prepare role/ownership checks before real write actions.
- Keep mock/demo mode stable.
- Ensure the first real write pilot has server-side role and ownership checks before implementation.

## 2. Current State

- App works without real auth.
- Internal cabinets are accessible directly in demo mode.
- Demo actions exist.
- Real writes are not connected.
- Supabase Auth is not active yet.
- Protected routes are not enforced yet.

## 3. Required Roles

Future roles:

- `client`
- `partner`
- `courier`
- `admin`
- `super_admin`
- `ai_dispatcher_system`

## 4. User/Profile Model Later

Likely profile fields:

- `id`
- `auth_user_id`
- `role`
- `full_name`
- `phone`
- `email`
- `partner_id` optional
- `courier_id` optional
- `status`
- `created_at`
- `updated_at`

Actual fields must match schema before implementation.

## 5. Role Permissions

### Client

- Access `/client/**`.
- View own orders/bookings.
- Create order/booking later.
- Request cancellation later.
- Cannot access partner/courier/admin.
- Cannot change payment status.

### Partner

- Access `/partner/**`.
- View only own partner data.
- Manage own orders/bookings/catalog/availability.
- Pause future orders/bookings.
- Cannot access other partners.
- Cannot change payment.
- Cannot force refund.
- Cannot cancel accepted order without admin.

### Courier

- Access `/courier/**`.
- View assigned/available deliveries according to rules.
- Update own delivery progress.
- Report issues.
- Cannot change payment.
- Cannot change order items.
- Cannot cancel order.

### Admin

- Access `/admin/**`.
- View operations.
- Manage delivery exceptions.
- Moderate partners/catalog.
- Review finance issues.
- High-risk actions require audit/approval.

### Super Admin

- Manage platform-level settings later.
- Manage admin roles later.
- Approve critical compliance flows later.
- Cannot bypass legal/licensing requirements.

### AI Dispatcher System

- Server-only role.
- Create recommendations/alerts/logs.
- Cannot execute high-risk actions.
- Cannot cancel orders.
- Cannot change payment.
- Cannot approve refunds.

## 6. Protected Route Plan

- `/client/**` requires `client` or `admin`/`super_admin`.
- `/partner/**` requires `partner` or `admin`/`super_admin`.
- `/courier/**` requires `courier` or `admin`/`super_admin`.
- `/admin/**` requires `admin` or `super_admin`.
- `/admin/settings` high-risk settings require `super_admin` later.
- Public pages remain public.

Protected route enforcement should happen server-side through middleware, layout checks or route guards after Supabase Auth is active.

## 7. Ownership Checks

### Partner

- Authenticated `partner_id` must match `order.partner_id`.
- Authenticated `partner_id` must match `booking.partner_id`.
- Authenticated `partner_id` must match `catalog_item.partner_id`.
- Authenticated `partner_id` must match `availability.partner_id`.

### Courier

- `courier_id` must match assigned delivery.
- Courier can update only own active delivery.
- Courier issues must belong to own delivery.

### Client

- Client can view only own orders/bookings.
- Client can request only own cancellation.

### Admin

- Admin actions must be logged.
- High-risk actions require reason and approval.

## 8. Auth Implementation Sequence Later

1. Confirm Supabase Auth project.
2. Confirm profiles/users table.
3. Add auth helpers.
4. Add server-side session reading.
5. Add role resolver.
6. Add protected route middleware or layout checks.
7. Add partner ownership helper.
8. Add courier ownership helper.
9. Add admin permission helper.
10. Test demo users.
11. Only then connect first real write pilot.

## 9. Test Users Later

Documented future test users:

- `client@test.kol`
- `partner@test.kol`
- `courier@test.kol`
- `admin@test.kol`
- `superadmin@test.kol`

Document only. Do not create users now.

## 10. Security Rules

- Never trust client-side role only.
- Server actions must verify role server-side.
- RLS must enforce role/ownership too.
- Service role key is server-only.
- No service key in client components.
- No raw auth errors in UI.
- High-risk actions require audit.
- AI dispatcher system actions must stay server-only.

## 11. Rollback

- Keep demo mode available.
- Keep `DATA_SOURCE_MODE=mock`.
- If auth breaks, disable protected route enforcement in local demo branch only.
- Do not delete mock data.
- Do not remove demo actions.
- Do not remove public access to public pages.

## 12. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- Auth roles cannot enable alcohol module.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- `super_admin` cannot activate alcohol without legal review, licensing and partner verification.
- Alcohol-related request is critical risk.

## 13. Next Stages

Recommended next stages:

1. `12M-2 Protected Route Strategy Checklist`
2. `12M-3 Role Helper Pseudocode`
3. `12N-1 Audit Log Implementation Plan`
4. `12O-1 First Real Write Implementation Preparation`

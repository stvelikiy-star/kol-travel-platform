# Internal Read Validation Plan

Stage: 12K-3 - Internal Read Validation Plan.

This plan defines how to validate future Supabase reads for internal operations without connecting real writes. Keep `DATA_SOURCE_MODE=mock` as the default until internal reads, RLS, role checks and ownership checks are verified in a Supabase TEST project.

`ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## 1. Goal

- Plan safe validation of internal Supabase reads.
- Verify partner, courier, admin and AI read access before real writes.
- Keep mock mode as fallback.
- Avoid exposing private operational data.
- Confirm internal pages can handle empty and error states without leaking secrets.

## 2. Internal Areas In Scope

### Partner

- `/partner`
- `/partner/orders`
- `/partner/bookings`
- `/partner/catalog`
- `/partner/availability`
- `/partner/delivery`
- `/partner/stop`
- `/partner/finance`
- `/partner/settings`

### Courier

- `/courier`
- `/courier/deliveries`
- `/courier/active`
- `/courier/issues`
- `/courier/history`
- `/courier/earnings`
- `/courier/profile`
- `/courier/dispatcher`

### Admin

- `/admin/delivery`
- `/admin/ai-dispatcher`
- `/admin/orders`
- `/admin/bookings`
- `/admin/partners`
- `/admin/couriers`
- `/admin/finance`
- `/admin/moderation`
- `/admin/settings`

## 3. Partner Read Validation

Future checks:

- Partner sees only own orders.
- Partner sees only own bookings.
- Partner sees only own catalog items.
- Partner sees only own availability rules.
- Partner sees own delivery handoff data.
- Partner cannot see other partner records.
- Partner cannot see private admin finance/audit data.
- Empty states work.
- Safe errors do not expose secrets.
- Partner pages keep using the data layer instead of direct Supabase imports.

## 4. Courier Read Validation

Future checks:

- Courier sees assigned deliveries.
- Courier sees allowed available deliveries if business rules allow.
- Courier sees own active delivery.
- Courier sees own issues.
- Courier sees own history.
- Courier sees own demo earnings/payout summary later.
- Courier cannot see other courier private data.
- Courier cannot see partner/admin private data.
- Empty states work.
- Safe errors do not expose secrets.
- Courier pages keep payment-sensitive data restricted.

## 5. Admin Read Validation

Future checks:

- Admin sees operational overview.
- Admin sees orders/bookings/deliveries.
- Admin sees partner/courier status.
- Admin sees delivery issues.
- Admin sees moderation queues.
- Admin sees finance review records.
- Admin sees high-risk approvals later.
- Audit logs are protected.
- `super_admin`-only settings remain restricted later.
- Admin read access is separated by admin permission level where needed.

## 6. AI Dispatcher Read Validation

Future checks:

- AI reads only server-approved operational summaries.
- AI can read delay context.
- AI can read issue summaries.
- AI can read delivery handoff context.
- AI can read recommendation/alert logs.
- AI cannot bypass RLS.
- AI cannot read unrestricted private user data.
- AI cannot execute actions from read context.
- AI read scope is limited to recommendation, alert and decision-log workflows.

## 7. Required Role And Ownership Checks

### Partner

- Authenticated user role = `partner`.
- `partner_id` matches owned partner.
- `order.partner_id` matches partner.
- `booking.partner_id` matches partner.
- `catalog_item.partner_id` matches partner.

### Courier

- Authenticated user role = `courier`.
- Delivery is assigned to courier or available under rules.
- Issue belongs to courier delivery.
- History belongs to courier.

### Admin

- Authenticated user role = `admin` or `super_admin`.
- High-risk data access should be logged later.
- Finance/private settings require stronger permissions later.
- Admin role level must be checked before exposing finance, settings or audit data.

## 8. Empty And Error State Checks

For every internal page:

- No 404.
- Clean empty state if no data.
- Loading state later if needed.
- Safe error message.
- No raw Supabase error details in UI.
- No service role key exposed.
- Mock fallback remains available.
- Pages still build without real Supabase env in mock mode.

## 9. Safety

- Keep `DATA_SOURCE_MODE=mock` until internal reads are validated.
- Do not remove mock data.
- Do not remove demo actions.
- Do not connect write actions yet.
- Never import service role key in client components.
- Do not expose private env variables.
- Validate reads before writes.
- Do not connect payments.
- Do not connect Telegram or n8n.
- Do not test internal reads against production first.

## 10. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- Internal reads must not expose or enable alcohol module.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- Future activation requires legal review, licensing, partner verification and `super_admin` approval.
- Alcohol-related request is critical risk.

## 11. Recommended Validation Order Later

1. Partner dashboard reads.
2. Partner orders/bookings reads.
3. Courier active delivery reads.
4. Courier issues/history reads.
5. Admin delivery reads.
6. Admin AI dispatcher reads.
7. Admin finance/moderation reads.
8. Rollback test to mock mode.

## 12. Next Stages

Recommended next stages:

1. `12K-4 Read Adapter Rollback Plan`
2. `12L-1 First Real Write Pilot Plan`
3. `12M Auth + Role Implementation Plan`

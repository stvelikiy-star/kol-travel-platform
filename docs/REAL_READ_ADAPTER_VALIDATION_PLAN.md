# Real Read Adapter Validation Plan

Stage: 12K-1 - Real Read Adapter Validation Plan.

This plan defines how to validate future Supabase read adapters safely before any real write actions are connected. The app must remain in `DATA_SOURCE_MODE=mock` until the Supabase TEST project, schema, RLS and seed data are verified.

`ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## 1. Goal

- Validate future Supabase read adapters safely.
- Keep mock mode as the fallback.
- Test reads before writes.
- Do not connect production data first.
- Confirm the app still builds and renders without real Supabase env values while mock mode is active.

## 2. Current Data Architecture

- The app currently works in mock mode.
- The data access layer exists in `src/lib/data`.
- Supabase read adapters are prepared/drafted for later validation.
- UI pages should not import Supabase directly.
- Pages should read through data layer functions such as catalog, orders, bookings, delivery, partners and admin helpers.
- Mock data remains the default data source until real read validation passes.

## 3. Read Adapter Validation Sequence

Recommended order:

1. Public catalog reads.
2. Partner dashboard reads.
3. Courier dashboard reads.
4. Admin delivery reads.
5. AI dispatcher reads.

This order keeps the earliest validation focused on low-risk public read paths, then moves toward internal operational data with stricter role and ownership requirements.

## 4. Public Catalog Read Validation

Future checks:

- Tours load from Supabase.
- Stays load from Supabase.
- Food items load from Supabase.
- Products load from Supabase.
- Partners load from Supabase.
- Public pages still render if Supabase returns empty data.
- Fallback behavior is documented.
- Public pages continue using data layer functions, not direct Supabase imports.

## 5. Partner Read Validation

Future checks:

- Partner sees only own orders.
- Partner sees only own bookings.
- Partner sees only own catalog items.
- Partner sees own availability.
- Partner does not see other partner data.
- RLS and ownership are verified before production.
- Empty partner data renders clean empty states.

## 6. Courier Read Validation

Future checks:

- Courier sees assigned deliveries.
- Courier sees allowed available deliveries.
- Courier sees own active delivery.
- Courier sees own issue/history data.
- Courier does not see private partner/admin data.
- Courier cannot read payment-sensitive fields beyond what the courier workflow requires.

## 7. Admin Read Validation

Future checks:

- Admin can see operational overview.
- Admin can see delivery issues.
- Admin can see partner/courier status.
- High-risk data visibility is controlled.
- Audit logs are not public.
- Finance and payment-related data remain restricted by admin role.

## 8. AI Dispatcher Read Validation

Future checks:

- AI can read only server-approved operational context.
- AI can read issue summaries.
- AI can read delivery delay context.
- AI cannot access unrestricted private data.
- AI cannot bypass RLS/role rules.
- AI read context is limited to recommendation, alert and decision-log workflows.

## 9. Empty and Error State Checks

Expected behavior:

- Empty table should show a clean empty state.
- Supabase error should show safe fallback or safe error.
- No raw error secrets should appear in UI.
- Service role key must never be shown.
- App must still build without real env in mock mode.
- If Supabase reads fail during future validation, rollback to `DATA_SOURCE_MODE=mock`.

## 10. Safety

- Keep `DATA_SOURCE_MODE=mock` until validation.
- Do not remove mock data.
- Do not remove demo actions.
- Never import service role key in client components.
- Do not expose private env variables.
- Validate reads before validating writes.
- Do not connect payments.
- Do not connect Telegram or n8n.
- Do not test against production data first.

## 11. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- Seed/read data must not enable alcohol module.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- Future activation requires legal review, licensing, partner verification and `super_admin` approval.
- Alcohol-related request is critical risk.

## 12. Next Stages

Recommended next stages:

1. `12K-2 Public Catalog Read Pilot Plan`
2. `12K-3 Internal Read Validation Plan`
3. `12K-4 Read Adapter Rollback Plan`
4. `12L-1 First Real Write Pilot Plan`

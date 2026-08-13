# First Real Write File Inspection Checklist

Stage: 12O-2 - First Real Write File Inspection Checklist.

Selected future real action:

- `markOrderReadyForPickupAction(orderId)`

Current demo action:

- `markOrderReadyForPickupDemoAction(orderId)`

This checklist is for inspection only. Do not implement the real write yet, do not connect Supabase, do not mutate mock data, and do not create a real server action in this stage.

`DATA_SOURCE_MODE=mock` remains the default. `ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## 1. Goal

- Inspect required files before first real write implementation.
- Avoid wrong table names, wrong helper imports and unsafe env usage.
- Keep demo/mock fallback stable.
- Confirm implementation is not started until schema, auth, audit, RLS and rollback are ready.

## 2. Files To Inspect Later Before Implementation

### Partner Action File

File:

- `src/app/actions/partner/partnerOrders.ts`

Check:

- Demo action exists.
- No real write yet.
- No Supabase write yet.
- No mock mutation.
- Safe result format exists.

### Shared Action Result

File:

- `src/app/actions/shared/action-result.ts`

Check:

- `DemoActionResult` exists.
- `createDemoActionResult` exists.
- `alcoholModuleEnabled: false` is enforced.

### Supabase Helpers

Files:

- `src/lib/supabase/*`

Check:

- Client/server split.
- Public anon client is safe.
- Service role is server-only if present.
- No service key imported into client components.

### Auth Helpers

Files:

- `src/lib/auth/*`

Check:

- Whether placeholders exist.
- Whether session/profile helpers exist or need future implementation.
- No auth enforcement yet unless intentionally planned.

### Data Layer

Files:

- `src/lib/data/*`

Check:

- Pages read through data layer.
- Mock mode remains default.
- No direct page-level Supabase imports.

### Types

File:

- `src/types/database.ts`

Check:

- Database types match intended schema if available.
- Order status types exist or need update later.
- Role/risk/status values are consistent.

### Schema

Files:

- `supabase/schema/001_initial_schema.sql`
- `supabase/schema/002_rls_policies_draft.sql`
- `supabase/schema/003_seed_demo_data_draft.sql`

Check:

- `orders` table name.
- `orders.id` field.
- `partner_id` field.
- `status` field.
- `payment_status` field.
- `ready_for_pickup_at` field.
- `updated_at` field.
- `audit_logs` table.
- RLS policy expectations.
- Seed order statuses.

### Partner UI Page

Files:

- `src/app/partner/orders/**`
- `src/app/partner/orders/[id]/**` if exists

Check:

- "Готов к выдаче" button exists.
- Button is currently connected to demo action only.
- Result panel works.
- No real action connected yet.

## 3. Schema Inspection Checklist

Confirm actual names:

- `orders` table.
- `audit_logs` table.
- partner/profile relation table.
- status enum or text values.
- ready-for-pickup timestamp field.
- partner ownership field.
- payment status field.

## 4. Auth Inspection Checklist

Confirm later:

- where current user session will be read;
- where profile/role will be loaded;
- how `partner_id` is resolved;
- how wrong-role users are blocked;
- how safe errors are returned.

## 5. RLS Inspection Checklist

Confirm later:

- Partner can update only own order.
- Partner cannot update `payment_status`.
- Partner cannot access other partner order.
- `audit_logs` are protected.
- Service role key is not exposed.

## 6. Implementation Readiness Decision

Before coding, mark:

- schema confirmed: yes/no;
- auth helper ready: yes/no;
- audit helper ready: yes/no;
- RLS ready: yes/no;
- test partner user ready: yes/no;
- rollback path ready: yes/no.

If any required item is "no", do not implement real write yet.

## 7. Safety Restrictions

First real write must not:

- Change `payment_status`.
- Change price.
- Change order items.
- Assign courier.
- Mark `picked_up`.
- Mark `delivered`.
- Cancel order.
- Refund order.
- Enable alcohol module.

## 8. Rollback

If inspection reveals mismatch:

- Do not implement action.
- Keep demo action.
- Keep `DATA_SOURCE_MODE=mock`.
- Fix docs/schema plan first.
- Run `npm run build`.
- Do not delete mock data.

## 9. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- This action must not enable alcohol module.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- `super_admin` cannot activate alcohol without legal review, licensing and partner verification.
- Alcohol-related request is critical risk.

## 10. Next Stages

Recommended next stages:

1. `12O-3 First Real Write Implementation Prompt Draft`
2. `12P-1 Supabase Auth Implementation Plan`
3. `12Q-1 Audit Helper Implementation Plan`
4. `12R-1 First Real Write Pilot Implementation Later`

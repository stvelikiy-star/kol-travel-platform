# First Real Write Implementation Preparation

Stage: 12O-1 - First Real Write Implementation Preparation.

This document prepares implementation of the first safe real backend write. Do not implement the real write yet, do not connect Supabase, do not mutate mock data, and do not create a real server action in this stage.

`DATA_SOURCE_MODE=mock` remains the default. `ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## 1. Goal

- Prepare implementation of the first safe real write.
- Avoid unsafe partner order updates.
- Verify required schema/auth/audit pieces before coding.
- Keep demo rollback path.
- Keep the first implementation scoped to one partner status transition.

## 2. First Real Action

- `markOrderReadyForPickupAction(orderId)`
- Role: `partner`
- `riskLevel: medium`
- `auditRequired: true`
- `humanApprovalRequired: false` in normal case

## 3. Current Demo Action

- `markOrderReadyForPickupDemoAction(orderId)`

The demo action must remain available until the real action is tested and stable.

## 4. Files To Inspect Before Implementation Later

Inspect these files before implementation later:

- `src/app/actions/partner/partnerOrders.ts`
- `src/app/actions/shared/action-result.ts`
- `src/lib/data/*`
- `src/lib/supabase/*`
- `src/lib/auth/*`
- `src/types/database.ts`
- `supabase/schema/001_initial_schema.sql`
- `supabase/schema/002_rls_policies_draft.sql`

Do not modify them in this stage.

## 5. Required Schema Confirmation

Before implementation, verify actual table/field names.

### orders Table

Confirm:

- `id`
- `partner_id`
- `status`
- `payment_status`
- `ready_for_pickup_at`
- `updated_at`
- `cancelled_at` if used
- `refunded_at` if used

### audit_logs Table

Confirm:

- `id`
- `actor_user_id`
- `actor_role`
- `action_type`
- `target_table`
- `target_id`
- `before_state`
- `after_state`
- `reason`
- `risk_level`
- `human_approval_required`
- `created_at`

## 6. Required Status Values

Allowed source statuses:

- `accepted_by_partner`
- `preparing`

Target status:

- `ready_for_pickup`

Blocked statuses:

- `new_order`
- `rejected`
- `cancelled`
- `picked_up`
- `courier_to_client`
- `delivered`
- `refunded`
- `admin_required` unless admin flow later

## 7. Required Auth Helpers Later

Future implementation needs:

- `getCurrentSession()`
- `getCurrentUserProfile()`
- `requirePartner()`
- `requirePartnerOrderOwnership(orderId)`
- safe error helper

Do not implement helpers now.

## 8. Required Audit Helper Later

Future implementation needs:

- `createAuditLogEntry(input)`

Audit must record:

- `before_state`
- `after_state`
- actor role `partner`
- `action_type = mark_order_ready_for_pickup`
- `risk_level = medium`

Do not implement helper now.

## 9. Implementation Safety Rules

The real action must not:

- Change `payment_status`.
- Change price.
- Change order items.
- Assign courier.
- Mark `picked_up`.
- Mark `delivered`.
- Cancel order.
- Refund order.
- Enable alcohol module.

## 10. Future Implementation Sequence

1. Confirm Supabase test project works.
2. Confirm SQL/RLS/seed data works.
3. Confirm auth test partner exists.
4. Confirm partner owns demo order.
5. Implement server-only action.
6. Validate role and ownership.
7. Validate status transition.
8. Update order status.
9. Create audit log.
10. Return safe result.
11. Connect only one button later.
12. Test rollback to demo/mock.

## 11. UI Connection Later

Button:

- `/partner/orders`
- "Готов к выдаче"

On success:

- show "Заказ готов к выдаче";
- show next step "Ожидает курьера".

On error:

- show safe error;
- do not show raw Supabase error;
- do not imply payment change.

## 12. Rollback

If implementation breaks:

- Keep demo action.
- Keep `DATA_SOURCE_MODE=mock`.
- Revert button to demo wiring.
- Run `npm run build`.
- Restart dev server.
- Verify `/partner/orders`.
- Do not delete mock data.
- Do not delete Supabase test data.

## 13. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- This action must not enable alcohol module.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- `super_admin` cannot activate alcohol without legal review, licensing and partner verification.
- Alcohol-related request is critical risk.

## 14. Next Stages

Recommended next stages:

1. `12O-2 First Real Write File Inspection Checklist`
2. `12O-3 First Real Write Implementation Prompt Draft`
3. `12P-1 Supabase Auth Implementation Plan`
4. `12Q-1 Audit Helper Implementation Plan`

# Stage 12R-1 - First Real Write Pilot Implementation Plan

Project: KOL / Issyk-Kul Travel & Delivery Platform.

This document defines the implementation plan for the first future real backend write. It is planning only. Do not implement the real action in this stage.

Selected future real action:

- `markOrderReadyForPickupAction(orderId)`

Current demo action:

- `markOrderReadyForPickupDemoAction(orderId)`

## 1. Goal

- Define the exact implementation plan for the first real backend write.
- Make the first real action safe and reversible.
- Confirm required auth, ownership, status transition, and audit behavior.
- Avoid payments, refunds, cancellation, and delivery-completion logic.

## 2. Selected First Real Action

- Action: `markOrderReadyForPickupAction(orderId)`
- Role: `partner`
- Risk level: `medium`
- Audit required: yes
- Human approval required: no in the normal case
- Target table: `orders`
- Target status: `ready_for_pickup`

## 3. Why This Action Is Selected

- Operationally useful.
- Low payment risk.
- No refund.
- No cancellation.
- No customer money movement.
- Clear status transition.
- Clear partner ownership requirement.
- Easy rollback to demo action.

## 4. Current Demo Action

- `markOrderReadyForPickupDemoAction(orderId)` must remain.
- The demo action is the fallback.
- Demo UI wiring must not be removed until the real action is tested.
- Demo mode remains default.

## 5. Pre-Implementation Blockers

Before real implementation, confirm:

- Supabase test project is ready.
- SQL schema is applied.
- RLS is verified.
- Seed data is verified.
- Supabase server client exists.
- Auth helpers exist.
- Role helpers exist.
- Ownership helper exists for partner order.
- Audit helper exists.
- Test partner user exists.
- Test order belongs to test partner.
- Rollback path is clear.

If any item is missing, do not implement the real action.

## 6. Required Future Files

Potential files for the later real implementation:

- `src/app/actions/partner/partnerOrders.ts`
- `src/lib/auth/*`
- `src/lib/audit/*`
- `src/lib/supabase/*`
- `src/app/actions/shared/action-result.ts` if a real result type is needed
- `docs/FIRST_REAL_WRITE_PILOT_IMPLEMENTATION_NOTES.md`
- `README.md`

Do not edit these files during this planning stage.

## 7. Required Validation Flow

The future real action must:

1. Validate `orderId`.
2. Require authenticated user.
3. Require partner role.
4. Resolve `partner_id` from profile/session.
5. Load order from database.
6. Verify order belongs to partner.
7. Verify order status is allowed.
8. Block invalid statuses.
9. Update only allowed fields.
10. Create audit log.
11. Return safe result.

## 8. Status Transition Rules

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
- `admin_required`
- any unknown status

## 9. Allowed Database Update

Only update:

- `status = ready_for_pickup`
- `ready_for_pickup_at = now()`
- `updated_at = now()`

Must not update:

- `payment_status`
- `price`
- `order_items`
- `courier_id`
- `picked_up_at`
- `delivered_at`
- `cancelled_at`
- `refunded_at`
- alcohol-related fields

## 10. Required Audit Log

Audit values:

- `actor_user_id = current user id`
- `actor_role = partner`
- `action_type = mark_order_ready_for_pickup`
- `target_table = orders`
- `target_id = orderId`
- `before_state = previous order status/time`
- `after_state = ready_for_pickup status/time`
- `risk_level = medium`
- `human_approval_required = false`
- `approval_id = null`

## 11. Safe Result Contract

The future real action should return:

```ts
{
  ok: boolean
  mode: "real"
  action: "mark_order_ready_for_pickup"
  message: string
  role: "partner"
  riskLevel: "medium"
  auditRequired: true
  humanApprovalRequired: false
  alcoholModuleEnabled: false
  auditLogId?: string
}
```

## 12. Safe Errors

The future action may return:

- `invalid_order_id`
- `not_authenticated`
- `not_authorized`
- `ownership_failed`
- `order_not_found`
- `invalid_status_transition`
- `audit_insert_failed`
- `database_update_failed`
- `server_error`

Never expose:

- raw Supabase error;
- SQL details;
- service role key;
- auth token;
- private environment values.

## 13. UI Wiring Strategy

Do not wire UI in the first real implementation unless explicitly requested later.

Recommended sequence:

1. Implement real action only.
2. Run build.
3. Test import safety.
4. Wire one button on `/partner/orders` in a separate stage.
5. Keep demo fallback available.

## 14. QA Plan

Future QA must verify:

- Partner can mark own `preparing` order ready.
- Partner can mark own `accepted_by_partner` order ready.
- Partner cannot mark another partner order.
- Partner cannot mark cancelled order.
- Partner cannot mark delivered order.
- Courier cannot call partner action.
- Client cannot call partner action.
- Admin behavior is intentionally defined before use.
- Audit log is created.
- `payment_status` does not change.
- Order items do not change.
- Alcohol module remains disabled.

## 15. Rollback

If the real action fails:

- keep `markOrderReadyForPickupDemoAction`;
- set `DATA_SOURCE_MODE=mock`;
- disconnect real UI wiring if any;
- revert only the real action changes;
- run `npm run build`;
- restart dev server;
- verify `/partner/orders` still works.

## 16. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales/delivery disabled.
- This action must not enable alcohol module.
- This action must not touch alcohol-related fields.
- AI cannot enable alcohol module.
- Partner/courier/admin cannot enable alcohol.
- Super admin cannot activate alcohol without legal review, licensing, and partner verification.
- Alcohol-related request is critical risk.

## 17. Final Readiness Decision

- First real write plan status: complete
- Auth dependency status: not ready
- Audit dependency status: not ready
- Supabase schema status: not ready for app connection
- RLS status: not ready for app connection
- Ready for real implementation: no

The plan is complete, but the real implementation should not start until Supabase, auth, RLS, seed data, ownership checks, and audit helper are verified.

## 18. Next Stages

- Stage 12R-2 - `markOrderReadyForPickupAction` Implementation
- Stage 12R-3 - First Real Write UI Wiring
- Stage 12R-4 - First Real Write QA
- Stage 12R-5 - First Real Write Rollback Check
- Stage 12S - Supabase Read Mode Pilot


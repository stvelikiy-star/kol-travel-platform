# First Real Write Implementation Prompt Draft

Stage: 12O-3 - First Real Write Implementation Prompt Draft.

This document contains a future Codex prompt draft for implementing the first real backend write. Do not implement the real write now, do not connect Supabase, do not mutate mock data, and do not create a real server action in this stage.

`DATA_SOURCE_MODE=mock` remains the default. `ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## Future Codex Prompt Draft

Use this prompt only after the pre-implementation requirements below are complete.

```text
STAGE 12R-1 - FIRST REAL WRITE PILOT IMPLEMENTATION

Project: KOL / Issyk-Kul Travel & Delivery Platform.

Task:
Implement the first real backend write action:

- markOrderReadyForPickupAction(orderId: string)

Current demo action:

- markOrderReadyForPickupDemoAction(orderId)

Important:
This is the first real write pilot. Keep the implementation narrow, server-side and reversible.

Pre-implementation requirements:

- Supabase test project is ready.
- SQL schema is applied.
- RLS is verified.
- Seed data is verified.
- Auth test partner exists.
- Partner owns test order.
- audit_logs table exists.
- Auth helpers exist.
- Audit helper exists.
- Rollback to mock mode is ready.

Allowed files for future implementation:

- src/app/actions/partner/partnerOrders.ts
- src/lib/auth/* only if helpers already exist or tiny import needed
- src/lib/supabase/* only if server client already exists
- src/app/actions/shared/action-result.ts only if real result type is needed
- docs/FIRST_REAL_WRITE_IMPLEMENTATION_NOTES.md
- README.md

Do not change:

- public pages
- client cabinet
- courier cabinet
- admin panel
- payment logic
- delivery completion logic
- database schema files
- Supabase setup files unless already prepared helper import is needed
- Telegram/n8n

Implementation rules:

- Add markOrderReadyForPickupAction(orderId: string).
- Keep markOrderReadyForPickupDemoAction(orderId).
- Do not remove demo action.
- Do not mutate mock data.
- Do not change public pages.
- Do not change payment logic.
- Do not change delivery completion logic.
- Do not enable alcohol module.

Action validation:

- Validate orderId.
- Require authenticated user.
- Require role partner.
- Resolve partner_id.
- Load order.
- Ensure order belongs to partner.
- Ensure status is accepted_by_partner or preparing.
- Block all other statuses.
- Do not change payment_status.
- Do not change order_items.
- Do not assign courier.
- Do not mark picked_up.
- Do not mark delivered.
- Do not cancel/refund.

Database update:

Update orders table:

- status = ready_for_pickup
- ready_for_pickup_at = now()
- updated_at = now()

Audit:

Create audit log:

- actor_user_id
- actor_role = partner
- action_type = mark_order_ready_for_pickup
- target_table = orders
- target_id = orderId
- before_state
- after_state
- risk_level = medium
- human_approval_required = false
- created_at

Result:

Return safe result:

- ok true/false
- mode real
- action mark_order_ready_for_pickup
- message
- riskLevel medium
- auditRequired true
- humanApprovalRequired false
- alcoholModuleEnabled false

Error handling:

Safe errors only:

- not authenticated
- not authorized
- order not found
- invalid ownership
- invalid status transition
- RLS denied
- server error

Never expose raw Supabase errors.

UI wiring:

- Do not wire UI in first implementation unless explicitly requested.
- Implementation can create action only first.
- UI wiring comes in a separate stage.

Tests:

- npm run build
- verify mock mode still builds
- verify action import does not break
- later test with test partner in Supabase mode

Rollback:

- keep demo action
- set DATA_SOURCE_MODE=mock
- revert UI to demo wiring if needed
- run npm run build
- do not delete mock data

Alcohol compliance:

- ALCOHOL_MODULE_ENABLED=false
- action must not enable alcohol module
- AI cannot enable alcohol module
- partner/courier/admin cannot enable alcohol
- alcohol-related request is critical risk

Final report:

- real action created
- demo action preserved
- audit behavior implemented
- safety checks implemented
- build result
- errors if any
- ready for UI wiring pilot
```

## 1. Pre-Implementation Requirements

Before using the future prompt:

- Supabase test project is ready.
- SQL schema is applied.
- RLS is verified.
- Seed data is verified.
- Auth test partner exists.
- Partner owns test order.
- `audit_logs` table exists.
- Auth helpers exist.
- Audit helper exists.
- Rollback to mock mode is ready.

## 2. Allowed Files For Future Implementation

- `src/app/actions/partner/partnerOrders.ts`
- `src/lib/auth/*` only if helpers already exist or tiny import needed
- `src/lib/supabase/*` only if server client already exists
- `src/app/actions/shared/action-result.ts` only if real result type is needed
- `docs/FIRST_REAL_WRITE_IMPLEMENTATION_NOTES.md`
- `README.md`

## 3. Future Implementation Rules

- Add `markOrderReadyForPickupAction(orderId: string)`.
- Keep `markOrderReadyForPickupDemoAction(orderId)`.
- Do not remove demo action.
- Do not mutate mock data.
- Do not change public pages.
- Do not change payment logic.
- Do not change delivery completion logic.
- Do not enable alcohol module.

## 4. Future Action Validation

- Validate `orderId`.
- Require authenticated user.
- Require role `partner`.
- Resolve `partner_id`.
- Load order.
- Ensure order belongs to partner.
- Ensure status is `accepted_by_partner` or `preparing`.
- Block all other statuses.
- Do not change `payment_status`.
- Do not change `order_items`.
- Do not assign courier.
- Do not mark `picked_up`.
- Do not mark `delivered`.
- Do not cancel/refund.

## 5. Future Database Update

Update `orders` table:

- `status = ready_for_pickup`
- `ready_for_pickup_at = now()`
- `updated_at = now()`

## 6. Future Audit

Create audit log:

- `actor_user_id`
- `actor_role = partner`
- `action_type = mark_order_ready_for_pickup`
- `target_table = orders`
- `target_id = orderId`
- `before_state`
- `after_state`
- `risk_level = medium`
- `human_approval_required = false`
- `created_at`

## 7. Future Result

Return safe result:

- `ok` true/false;
- `mode` real;
- `action` `mark_order_ready_for_pickup`;
- `message`;
- `riskLevel` medium;
- `auditRequired` true;
- `humanApprovalRequired` false;
- `alcoholModuleEnabled` false.

## 8. Future Error Handling

Safe errors only:

- not authenticated;
- not authorized;
- order not found;
- invalid ownership;
- invalid status transition;
- RLS denied;
- server error.

Never expose raw Supabase errors.

## 9. Future UI Wiring

- Do not wire UI in first implementation unless explicitly requested.
- Implementation can create action only first.
- UI wiring comes in separate stage.

## 10. Future Tests

- `npm run build`
- Verify mock mode still builds.
- Verify action import does not break.
- Later test with test partner in Supabase mode.

## 11. Rollback

- Keep demo action.
- Set `DATA_SOURCE_MODE=mock`.
- Revert UI to demo wiring if needed.
- Run `npm run build`.
- Do not delete mock data.

## 12. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Action must not enable alcohol module.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- Alcohol-related request is critical risk.

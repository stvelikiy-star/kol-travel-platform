# Audit Helper Implementation Plan

Stage: 12Q-1 - Audit Helper Implementation Plan.

This document plans future audit helper implementation. Do not implement audit helper code yet, do not connect Supabase, do not create real audit writes, and do not create real backend writes in this stage.

`DATA_SOURCE_MODE=mock` remains the default. `ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## 1. Goal

- Plan future audit helper implementation.
- Centralize audit logging logic.
- Support real server actions later.
- Support first real write pilot later.
- Keep high-risk actions traceable.
- Keep audit writes server-only and safe.

## 2. Current State

- Audit log implementation plan exists.
- Audit log helper pseudocode exists.
- High-risk approval planning exists.
- Auth/role planning exists.
- No real audit writes yet.
- No real backend writes yet.
- App still runs in mock/demo mode.

## 3. Future Helper Purpose

Audit helper should create safe audit records for:

- partner actions;
- courier actions;
- admin actions;
- AI dispatcher logs;
- high-risk approval decisions;
- first real write action: `markOrderReadyForPickupAction(orderId)`.

## 4. Future File Structure

Plan future files:

- `src/lib/audit/types.ts`
- `src/lib/audit/errors.ts`
- `src/lib/audit/sanitize.ts`
- `src/lib/audit/createAuditLogEntry.ts`
- `src/lib/audit/index.ts`

Do not create these files now. Document only.

## 5. Future types.ts

Define future types:

- `AuditActorRole`
- `AuditRiskLevel`
- `AuditLogInput`
- `AuditLogResult`
- `AuditTargetTable`
- `AuditActionType`

Roles:

- `client`
- `partner`
- `courier`
- `admin`
- `super_admin`
- `ai_dispatcher_system`

Risk levels:

- `low`
- `medium`
- `high`
- `critical`

## 6. Future errors.ts

Plan safe audit errors:

- `createAuditValidationError()`
- `createAuditInsertError()`
- `createAuditServerError()`

Error codes:

- `audit_validation_failed`
- `audit_insert_failed`
- `audit_not_configured`
- `server_error`

Never expose raw Supabase errors.

## 7. Future sanitize.ts

Plan sanitizer for `before_state` and `after_state`.

Remove:

- service role key;
- auth tokens;
- password;
- raw payment card data;
- unnecessary personal data;
- private env values.

Keep only operational fields required for audit.

## 8. Future createAuditLogEntry.ts

Future helper:

```ts
createAuditLogEntry(input)
```

Required input:

- `actorUserId`
- `actorRole`
- `actionType`
- `targetTable`
- `targetId`
- `beforeState` optional
- `afterState` optional
- `reason` optional
- `riskLevel`
- `humanApprovalRequired`
- `approvalId` optional

Required behavior:

- validate required fields;
- validate actor role;
- validate risk level;
- sanitize before/after state;
- insert audit log;
- return safe result;
- never expose raw database error.

## 9. Transaction Rule

- Important writes should update target record and audit log in one safe flow.
- High/critical actions should not be considered complete if audit fails.
- Prefer RPC/database transaction later for critical operations.
- First pilot may document transaction limitations if using simple server action.

## 10. First Real Write Integration

Future `markOrderReadyForPickupAction(orderId)` must create audit log:

- `actor_role = partner`
- `action_type = mark_order_ready_for_pickup`
- `target_table = orders`
- `target_id = orderId`
- `before_state = previous order status/time`
- `after_state = ready_for_pickup status/time`
- `risk_level = medium`
- `human_approval_required = false`

## 11. High-Risk Approval Integration

Future approval decisions must create audit log:

- approval created;
- approval approved;
- approval rejected;
- approval expired/cancelled;
- critical action reviewed.

## 12. AI Dispatcher Audit

AI dispatcher may log:

- `recommendation_created`
- `alert_created`
- `safety_refusal`
- `high_risk_suggestion`

AI dispatcher must not:

- approve high-risk actions;
- execute high-risk actions;
- cancel orders;
- change payment;
- approve refunds;
- enable alcohol module.

## 13. Admin Audit

Admin actions requiring audit:

- assign courier;
- reassign courier;
- resolve issue;
- force close issue;
- force complete order;
- block/unblock partner;
- block/unblock courier;
- payment review;
- refund request;
- role change;
- platform setting change.

## 14. Partner/Courier Audit

Partner:

- mark `ready_for_pickup`;
- report issue;
- pause business;
- emergency stop;
- availability conflict;
- catalog stop.

Courier:

- delivery issue;
- emergency incident;
- admin support request;
- status updates if needed.

## 15. Security

- Audit helper must be server-only.
- No audit insert from client components.
- No service role key in client components.
- Audit table should not be publicly writable.
- Audit table should not be publicly readable.
- RLS still required.
- Server-side auth/role checks still required.

## 16. Rollback

- Keep `DATA_SOURCE_MODE=mock`.
- Keep demo actions.
- Keep mock data.
- Do not wire real audit helper until auth/RLS/schema are ready.
- If future audit implementation breaks, disable real action and return to demo action.

## 17. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- Alcohol-related request is critical risk.
- Alcohol-related audit requires legal/admin/`super_admin` review later.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- `super_admin` cannot activate alcohol without legal review, licensing and partner verification.

## 18. Next Stages

Recommended next stages:

1. `12Q-2 Audit Helper File Plan`
2. `12Q-3 Audit Helper Implementation Prompt Draft`
3. `12Q-4 Audit Helper Final Readiness Audit`
4. `12R-1 First Real Write Pilot Implementation Plan`

# Audit Helper File Plan

Stage: 12Q-2 - Audit Helper File Plan.

This document defines future audit helper file structure. Do not implement audit helper code yet, do not connect Supabase, do not create real audit writes, and do not create real backend writes in this stage.

`DATA_SOURCE_MODE=mock` remains the default. `ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## 1. Goal

- Define future audit helper file structure.
- Keep audit logic centralized.
- Prepare safe audit logging for real server actions.
- Support first real write pilot later.
- Avoid duplicated audit code inside action files.

## 2. Current State

- Audit implementation plan exists.
- Audit helper pseudocode exists.
- No real audit helper code yet.
- No real Supabase audit writes yet.
- Demo actions remain active.
- App remains in mock mode.

## 3. Future Folder Structure

Plan future files under `src/lib/audit/`:

- `types.ts`
- `errors.ts`
- `sanitize.ts`
- `createAuditLogEntry.ts`
- `index.ts`

Do not create these files now. Document only.

## 4. types.ts Plan

Future file:

- `src/lib/audit/types.ts`

Purpose:

- central audit types;
- shared role/risk/action/target types;
- safe input/output contracts.

Future types:

- `AuditActorRole`
- `AuditRiskLevel`
- `AuditActionType`
- `AuditTargetTable`
- `AuditLogInput`
- `AuditLogResult`
- `AuditSafeError`

`AuditActorRole`:

- `client`
- `partner`
- `courier`
- `admin`
- `super_admin`
- `ai_dispatcher_system`

`AuditRiskLevel`:

- `low`
- `medium`
- `high`
- `critical`

`AuditLogInput` should include:

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

`AuditLogResult` should include:

- `ok`
- `auditLogId` optional
- `code` optional
- `message`

## 5. errors.ts Plan

Future file:

- `src/lib/audit/errors.ts`

Purpose:

- return safe audit errors;
- never expose raw Supabase/database errors.

Future helpers:

- `createAuditValidationError(message)`
- `createAuditInsertError()`
- `createAuditNotConfiguredError()`
- `createAuditServerError()`

Allowed error codes:

- `audit_validation_failed`
- `audit_insert_failed`
- `audit_not_configured`
- `server_error`

Rules:

- no raw database error in UI;
- no secret values in message;
- safe message only.

## 6. sanitize.ts Plan

Future file:

- `src/lib/audit/sanitize.ts`

Purpose:

- sanitize `before_state` and `after_state` before audit insert.

Remove fields containing:

- `password`
- `token`
- `secret`
- `service_role`
- `serviceRole`
- `authorization`
- `cookie`
- `payment_card`
- `card_number`
- `cvv`
- `private_key`
- `env`

Also avoid storing:

- raw auth session;
- raw Supabase response;
- full payment card data;
- unnecessary personal data;
- private env values.

Keep:

- operational status fields;
- ids required for traceability;
- timestamps;
- role/action metadata;
- safe before/after summaries.

## 7. createAuditLogEntry.ts Plan

Future file:

- `src/lib/audit/createAuditLogEntry.ts`

Purpose:

- main server-only helper for audit insert.

Future function:

```ts
createAuditLogEntry(input: AuditLogInput): Promise<AuditLogResult>
```

Responsibilities:

- validate required fields;
- validate `actorRole`;
- validate `riskLevel`;
- sanitize `beforeState`;
- sanitize `afterState`;
- prepare database payload;
- insert into `audit_logs` table;
- return safe result;
- never expose raw Supabase error.

Required validation:

- `actorUserId` must exist;
- `actorRole` must be valid;
- `actionType` must exist;
- `targetTable` must exist;
- `targetId` must exist;
- `riskLevel` must be valid.

## 8. index.ts Plan

Future file:

- `src/lib/audit/index.ts`

Purpose:

- safe exports from audit module.

Future exports:

- `createAuditLogEntry`
- audit types
- safe audit errors
- sanitize helper only if needed internally

Rule:

- keep client-unsafe exports clearly server-only if needed;
- do not export service-role client to browser code.

## 9. Server-Only Requirement

Audit helper must be used only from:

- server actions;
- server utilities;
- future backend/RPC wrappers.

Audit helper must not be used directly from:

- client components;
- browser event handlers;
- public API without auth/role checks.

## 10. Future Usage Example

For `markOrderReadyForPickupAction(orderId)`:

Flow:

1. Require authenticated partner.
2. Verify partner order ownership.
3. Load before order.
4. Validate status transition.
5. Update order to `ready_for_pickup`.
6. Call `createAuditLogEntry`.
7. Return safe result.

Audit values:

- `actorRole = partner`
- `actionType = mark_order_ready_for_pickup`
- `targetTable = orders`
- `targetId = orderId`
- `riskLevel = medium`
- `humanApprovalRequired = false`

## 11. High-Risk Approval Usage Example

For approval decision:

- `approveHighRiskAction`
- `rejectHighRiskAction`

Audit values:

- `actorRole = admin` or `super_admin`
- `actionType = approval_approved` or `approval_rejected`
- `targetTable = high_risk_approvals`
- `targetId = approvalId`
- `riskLevel = high` or `critical`
- `humanApprovalRequired = true`

## 12. AI Dispatcher Usage Example

AI dispatcher may log:

- `recommendation_created`
- `alert_created`
- `safety_refusal`
- `high_risk_suggestion`

AI dispatcher must not:

- execute high-risk action;
- approve high-risk action;
- cancel order;
- change payment;
- approve refund;
- enable alcohol module.

## 13. Schema Dependency

Future implementation must verify actual `audit_logs` fields before coding:

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
- `approval_id`
- `created_at`

Do not modify schema now.

## 14. Security

- Service role key is server-only.
- No service role key in client components.
- Audit table is not publicly writable.
- Audit table is not publicly readable.
- RLS still required.
- Server-side auth/role/ownership checks still required.
- No raw database errors in UI.

## 15. Rollback

- Keep `DATA_SOURCE_MODE=mock`.
- Keep demo actions.
- Keep mock data.
- Do not wire real audit helper until auth/RLS/schema are ready.
- If future audit helper breaks, return to demo actions.

## 16. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- Alcohol-related request is critical risk.
- Alcohol-related audit requires legal/admin/`super_admin` review later.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- `super_admin` cannot activate alcohol without legal review, licensing and partner verification.

## 17. Next Stages

Recommended next stages:

1. `12Q-3 Audit Helper Implementation Prompt Draft`
2. `12Q-4 Audit Helper Final Readiness Audit`
3. `12R-1 First Real Write Pilot Implementation Plan`

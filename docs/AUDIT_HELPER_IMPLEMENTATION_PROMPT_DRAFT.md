# Stage 12Q-3 - Audit Helper Implementation Prompt Draft

Project: KOL / Issyk-Kul Travel & Delivery Platform.

This document is a future Codex prompt draft for implementing the audit helper later. It is planning only. Do not implement the helper during this stage.

## Future Codex Prompt

Implement the server-only audit helper for KOL internal backend actions.

Important constraints:

- Do not change public pages.
- Do not change client, partner, courier, or admin UI behavior.
- Do not mutate mock data.
- Do not remove demo actions.
- Do not connect payments.
- Do not connect Telegram or n8n.
- Do not enable alcohol module.
- `ALCOHOL_MODULE_ENABLED=false`.
- `DATA_SOURCE_MODE=mock` must remain the safe default unless this future stage explicitly switches to a verified test mode.

## 1. Pre-Implementation Requirements

Before implementation, confirm:

- Supabase test project is ready.
- SQL schema is applied.
- RLS is verified.
- `audit_logs` table exists.
- Auth helpers exist.
- Role helpers exist.
- Ownership helpers exist or are available for the first real action.
- Supabase server client exists.
- Rollback path is ready.
- Mock mode still works.

## 2. Future Implementation Goal

Create a server-only audit helper module that:

- centralizes audit log creation;
- supports the first real write action;
- supports the high-risk approval flow later;
- sanitizes `before_state` and `after_state`;
- returns safe errors only;
- never exposes secrets or raw database errors.

## 3. Future Files To Create

Create:

- `src/lib/audit/types.ts`
- `src/lib/audit/errors.ts`
- `src/lib/audit/sanitize.ts`
- `src/lib/audit/createAuditLogEntry.ts`
- `src/lib/audit/index.ts`

Also create implementation notes:

- `docs/AUDIT_HELPER_IMPLEMENTATION_NOTES.md`

## 4. Future `types.ts`

Define:

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

`AuditLogInput`:

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

`AuditLogResult`:

- `ok`
- `auditLogId` optional
- `code` optional
- `message`

## 5. Future `errors.ts`

Create safe error helpers:

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

- never expose raw Supabase errors;
- never expose secrets;
- return safe messages only.

## 6. Future `sanitize.ts`

Create:

- `sanitizeAuditState(value)`

Purpose:

- sanitize `beforeState` and `afterState` before database insert.

Remove keys containing:

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

Also remove:

- raw auth session;
- raw Supabase response;
- full payment card data;
- unnecessary personal data;
- private environment values.

Keep:

- ids needed for traceability;
- operational status fields;
- timestamps;
- role and action metadata;
- safe before/after summaries.

## 7. Future `createAuditLogEntry.ts`

Create:

```ts
createAuditLogEntry(input: AuditLogInput): Promise<AuditLogResult>
```

Behavior:

- validate required fields;
- validate `actorRole`;
- validate `riskLevel`;
- validate `actionType` exists;
- validate `targetTable` exists;
- validate `targetId` exists;
- sanitize `beforeState`;
- sanitize `afterState`;
- prepare `audit_logs` payload;
- insert audit log using the server-side Supabase client;
- return `ok: true` with `auditLogId`;
- on failure, return safe error only.

## 8. Validation Rules

Required:

- `actorUserId`
- `actorRole`
- `actionType`
- `targetTable`
- `targetId`
- `riskLevel`

Valid risk levels:

- `low`
- `medium`
- `high`
- `critical`

Valid roles:

- `client`
- `partner`
- `courier`
- `admin`
- `super_admin`
- `ai_dispatcher_system`

## 9. Server-Only Rules

- Audit helper must be server-only.
- Do not import the audit insert helper into client components.
- Do not expose the service role key.
- Do not expose raw database errors.
- Do not make public unauthenticated audit inserts possible.

## 10. Future First Real Write Usage

For `markOrderReadyForPickupAction(orderId)`, use:

- `actorRole = partner`
- `actionType = mark_order_ready_for_pickup`
- `targetTable = orders`
- `targetId = orderId`
- `beforeState = previous order status/time`
- `afterState = ready_for_pickup status/time`
- `riskLevel = medium`
- `humanApprovalRequired = false`

## 11. Future High-Risk Approval Usage

Approval created:

- `actionType = high_risk_approval_created`
- `targetTable = high_risk_approvals`
- `targetId = approvalId`
- `riskLevel = high` or `critical`
- `humanApprovalRequired = true`

Approval approved:

- `actionType = high_risk_approval_approved`

Approval rejected:

- `actionType = high_risk_approval_rejected`

## 12. Transaction Note

Record in implementation notes:

- simple insert may be acceptable for an early medium-risk pilot;
- high/critical writes should use a stronger transaction or RPC later;
- high/critical action should not be considered complete if audit fails;
- first real write must clearly report if audit failed.

## 13. Safe Error Handling

Return only safe errors:

- `audit_validation_failed`
- `audit_insert_failed`
- `audit_not_configured`
- `server_error`

Never expose:

- raw Supabase error;
- SQL details;
- service role key;
- auth token;
- private environment values.

## 14. Tests

Run:

```bash
npm run build
```

Also verify:

- mock mode still works;
- public pages still build;
- dashboards still build;
- demo actions are not removed;
- no route protection is accidentally added;
- no Supabase env is required during mock build unless already required by the project.

## 15. Rollback

If implementation breaks later:

- remove the audit helper import from the real action;
- keep demo actions;
- keep `DATA_SOURCE_MODE=mock`;
- keep mock data;
- run `npm run build`;
- restart the dev server.

## 16. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Audit helper must not enable alcohol module.
- Alcohol sales/delivery disabled.
- Alcohol-related request is critical risk.
- Alcohol-related audit requires legal/admin/super_admin review later.
- AI cannot enable alcohol module.
- Partner/courier/admin cannot enable alcohol.
- Super admin cannot activate alcohol without legal review, licensing, and partner verification.

## 17. Future Implementation Notes Document

The future implementation stage should create:

- `docs/AUDIT_HELPER_IMPLEMENTATION_NOTES.md`

It should record:

- files created;
- helper behavior;
- build result;
- known limitations;
- rollback path.

## 18. Next Stages

- Stage 12Q-4 - Audit Helper Final Readiness Audit
- Stage 12R-1 - First Real Write Pilot Implementation Plan
- Stage 12R-2 - `markOrderReadyForPickupAction` Implementation Later


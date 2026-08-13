# Stage 12S-4 - Audit Helper Implementation Readiness

Project: KOL / Issyk-Kul Travel & Delivery Platform.

This document defines readiness for future audit helper implementation. It does not implement the audit helper, connect Supabase, create audit writes, create backend writes, implement auth helpers, protect routes, wire real actions, or mutate mock data.

## 1. Goal

- Confirm what is needed before implementing audit helper.
- Prevent unsafe audit writes.
- Prepare first real write audit logging.
- Prepare high-risk approval audit logging.
- Keep mock/demo mode stable.

## 2. Current State

- Audit helper planning docs exist.
- Audit helper file plan exists.
- Audit helper implementation prompt draft exists.
- Supabase server client is not implemented yet.
- Auth helpers are not implemented yet.
- Real audit writes are not active.
- Real backend writes are not active.
- `DATA_SOURCE_MODE=mock` remains default.

## 3. Required Docs To Verify

Future implementation should stay consistent with:

- `docs/AUDIT_LOG_IMPLEMENTATION_PLAN.md`
- `docs/AUDIT_LOG_HELPER_PSEUDOCODE.md`
- `docs/AUDIT_HELPER_IMPLEMENTATION_PLAN.md`
- `docs/AUDIT_HELPER_FILE_PLAN.md`
- `docs/AUDIT_HELPER_IMPLEMENTATION_PROMPT_DRAFT.md`
- `docs/AUDIT_HELPER_FINAL_READINESS_AUDIT.md`
- `docs/HIGH_RISK_APPROVAL_IMPLEMENTATION_PLAN.md`
- `docs/HIGH_RISK_APPROVAL_HELPER_PSEUDOCODE.md`
- `docs/SUPABASE_SERVER_CLIENT_READINESS_PLAN.md`
- `docs/AUTH_HELPER_IMPLEMENTATION_READINESS.md`

## 4. Future Audit Dependency Checklist

| Dependency | Ready | Not Ready | Unknown | Notes |
| --- | --- | --- | --- | --- |
| Supabase test project exists |  |  | Yes | Must be confirmed outside this repo. |
| Supabase server client exists |  | Yes |  | Planned only. |
| `audit_logs` table exists |  |  | Yes | Depends on schema application. |
| `audit_logs` fields confirmed |  |  | Yes | Must match helper contract. |
| RLS policies for `audit_logs` verified |  |  | Yes | Required before real writes. |
| Auth helpers exist |  | Yes |  | Planned only. |
| Role helpers exist |  | Yes |  | Planned only. |
| Ownership helpers exist |  | Yes |  | Planned only. |
| Safe error helpers planned | Yes |  |  | Planned in prior docs. |
| Sanitizer planned | Yes |  |  | Planned in prior docs. |
| Test partner user exists |  |  | Yes | Future test project requirement. |
| Test order exists |  |  | Yes | Future seed/test requirement. |
| Audit insert can be tested safely |  | Yes |  | No real audit writes yet. |
| Rollback to mock mode confirmed | Yes |  |  | Keep demo mode default. |
| Build passes | Yes |  |  | Must remain true. |

## 5. Future Audit Helper Files

Future files are planned:

- `src/lib/audit/types.ts`
- `src/lib/audit/errors.ts`
- `src/lib/audit/sanitize.ts`
- `src/lib/audit/createAuditLogEntry.ts`
- `src/lib/audit/index.ts`

Do not create these files during this readiness stage.

## 6. Future Audit Helper Functions

Main:

- `createAuditLogEntry(input)`

Supporting:

- `sanitizeAuditState(value)`
- `createAuditValidationError(message)`
- `createAuditInsertError()`
- `createAuditNotConfiguredError()`
- `createAuditServerError()`

## 7. Required Input Contract

`AuditLogInput` must include:

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

## 8. Required Result Contract

`AuditLogResult` must include:

- `ok`
- `auditLogId` optional
- `code` optional
- `message`

## 9. Required Roles

- `client`
- `partner`
- `courier`
- `admin`
- `super_admin`
- `ai_dispatcher_system`

## 10. Required Risk Levels

- `low`
- `medium`
- `high`
- `critical`

## 11. Sanitizer Readiness

Future sanitizer must remove:

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
- raw auth session
- raw Supabase response
- private env values
- unnecessary personal data

Keep:

- operational status fields;
- ids required for traceability;
- timestamps;
- safe before/after summaries.

## 12. First Real Write Dependency

`markOrderReadyForPickupAction(orderId)` later must create audit log:

- `actorRole = partner`
- `actionType = mark_order_ready_for_pickup`
- `targetTable = orders`
- `targetId = orderId`
- `beforeState = previous order status/time`
- `afterState = ready_for_pickup status/time`
- `riskLevel = medium`
- `humanApprovalRequired = false`

## 13. High-Risk Approval Dependency

Future approval actions must create audit logs:

- `high_risk_approval_created`
- `high_risk_approval_approved`
- `high_risk_approval_rejected`
- `high_risk_approval_expired`
- `high_risk_approval_cancelled`

## 14. AI Dispatcher Audit Readiness

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

## 15. Hard Blocker Rule

Do not implement real audit helper or real write if these are missing:

- Supabase server client;
- `audit_logs` table;
- RLS verification;
- auth helper;
- role helper;
- ownership helper for first real write;
- safe sanitizer;
- rollback path.

## 16. Security

- Audit helper must be server-only.
- No audit insert from client components.
- No service role key in client components.
- No raw Supabase/database errors in UI.
- Audit table must not be publicly writable.
- Audit table must not be publicly readable.
- RLS is still required.
- Server-side auth, role, and ownership checks are still required.

## 17. Transaction Readiness

- Medium-risk first pilot may use a simple safe flow if limitations are documented.
- High/critical actions should use stronger RPC/transaction later.
- High/critical actions should not be considered complete if audit fails.
- Audit failure must return a safe error.

## 18. Mock Mode Requirement

Future implementation must keep:

- `DATA_SOURCE_MODE=mock` working;
- demo actions available;
- demo dashboards accessible;
- `npm run build` passing;
- no accidental real writes;
- no accidental route protection.

## 19. Rollback

If future audit helper implementation breaks:

- disconnect real action if any;
- keep `DATA_SOURCE_MODE=mock`;
- keep demo actions;
- keep mock data;
- run `npm run build`;
- restart dev server.

## 20. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Audit helper must not enable alcohol module.
- Alcohol sales/delivery disabled.
- Alcohol-related request is critical risk.
- Alcohol-related audit requires legal/admin/super_admin review later.
- AI cannot enable alcohol module.
- Partner/courier/admin cannot enable alcohol.
- Super admin cannot activate alcohol without legal review, licensing, and partner verification.

## 21. Final Readiness

- Supabase server client readiness: not ready
- `audit_logs` table readiness: unknown
- RLS readiness: unknown
- Auth helper readiness: not ready
- Role helper readiness: not ready
- Ownership helper readiness: not ready
- Audit sanitizer readiness: planned, not implemented
- First real write audit readiness: not ready
- Final decision: do not proceed; manual confirmation and dependency implementation required

## 22. Next Stages

- Stage 12S-5 - Test Users + RLS Verification Plan
- Stage 12S-6 - Dependency Final Readiness Audit
- Then return to Stage 12R real write implementation


# High-Risk Approval Helper Pseudocode

Stage: 12N-4 - High-Risk Approval Helper Pseudocode.

This document defines future high-risk approval helper logic before implementation. Do not implement approval helper code yet, do not connect Supabase, and do not create real backend writes in this stage.

`DATA_SOURCE_MODE=mock` remains the default. `ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## 1. Goal

- Define future approval helper logic before implementation.
- Prevent automatic execution of high-risk actions.
- Make admin approval required for dangerous operations.
- Connect approval requests with audit logs later.
- Keep high-risk actions in request/review mode until auth, RLS and audit are ready.

## 2. Future Helper Names

- `createHighRiskApprovalRequest(input)`
- `approveHighRiskAction(approvalId, adminComment)`
- `rejectHighRiskAction(approvalId, adminComment)`
- `requireApprovalForRiskLevel(riskLevel)`

## 3. Future Input Shape For createHighRiskApprovalRequest

```ts
{
  requestedBy: string
  requestedRole: "client" | "partner" | "courier" | "admin" | "ai_dispatcher_system"
  actionType: string
  targetTable: string
  targetId: string
  riskLevel: "high" | "critical"
  reason: string
  proposedAfterState?: object
  aiRecommendationId?: string
}
```

## 4. Future Output Shape

```ts
{
  ok: boolean
  approvalId?: string
  approvalStatus?: "pending" | "approved" | "rejected" | "expired" | "cancelled"
  message: string
}
```

## 5. Pseudocode For createHighRiskApprovalRequest

### Step 1: Validate Required Fields

Validate:

- `requestedBy`
- `requestedRole`
- `actionType`
- `targetTable`
- `targetId`
- `riskLevel`
- `reason`

### Step 2: Allow Only High/Critical Risk

Allow only:

- `high`
- `critical`

### Step 3: Validate Reason

- Reason must not be empty.
- Reason should be stored for admin review.
- Reason must not contain secrets or raw credentials.

### Step 4: Sanitize proposedAfterState

Do not store:

- secrets;
- auth tokens;
- service role key;
- raw payment card data.

### Step 5: Create Approval Request

Create:

- `requested_by`
- `requested_role`
- `action_type`
- `target_table`
- `target_id`
- `risk_level`
- `reason`
- `proposed_after_state`
- `ai_recommendation_id`
- `approval_status = pending`
- `created_at`

### Step 6: Return

Return:

```ts
{
  ok: true,
  approvalId,
  approvalStatus: "pending",
  message: "High-risk approval request created. Action is not executed yet."
}
```

## 6. Pseudocode For approveHighRiskAction

### Step 1: Require Admin Or Super Admin

- Require role `admin` or `super_admin`.

### Step 2: Load Approval Request

- Load by `approvalId`.
- If not found, return safe error.

### Step 3: Check Status

- Check status is `pending`.
- If not pending, return safe error.

### Step 4: Require adminComment

- `adminComment` must be provided.
- Comment is stored with the approval decision.

### Step 5: Critical Risk Review

If `riskLevel` is `critical`:

- require stronger approval later if needed;
- legal/compliance review later for alcohol/legal/payment cases.

### Step 6: Set Approved Status

- Set `approval_status = approved`.

### Step 7: Set Decision Fields

- Set `approved_by`.
- Set `decided_at`.

### Step 8: Create Audit Log

- Create audit log for approval decision.

### Step 9: Return Safe Success

Return safe success.

Important: approval alone may not execute final business action unless implementation explicitly supports that later.

## 7. Pseudocode For rejectHighRiskAction

### Step 1: Require Admin Or Super Admin

- Require role `admin` or `super_admin`.

### Step 2: Load Approval Request

- Load by `approvalId`.
- If not found, return safe error.

### Step 3: Check Status

- Check status is `pending`.
- If not pending, return safe error.

### Step 4: Require adminComment

- `adminComment` must be provided.

### Step 5: Set Rejected Status

- Set `approval_status = rejected`.

### Step 6: Set Decision Fields

- Set `rejected_by`.
- Set `decided_at`.

### Step 7: Create Audit Log

- Create audit log for rejection.

### Step 8: Return Safe Success

Return safe success without executing the requested action.

## 8. Pseudocode For requireApprovalForRiskLevel

- `low`: approval not required.
- `medium`: approval usually not required, audit may be required.
- `high`: approval required.
- `critical`: approval required and stronger review may be required.

## 9. Actions That Must Create Approval Request

- Cancel accepted order.
- Cancel order after pickup.
- Confirmed booking cancellation.
- Payment status change.
- Refund approval.
- Force complete order.
- Force close delivery issue.
- Courier reassignment after pickup.
- Block/unblock partner.
- Block/unblock courier.
- Role change.
- Platform setting change.
- Alcohol-related request.
- Legal/compliance exception.

## 10. AI Dispatcher Restrictions

- AI can create recommendation.
- AI can create alert.
- AI can suggest high-risk approval request.
- AI cannot approve high-risk action.
- AI cannot execute high-risk action.
- AI cannot cancel order.
- AI cannot change payment.
- AI cannot approve refund.
- AI cannot enable alcohol module.

## 11. Admin Restrictions

- Admin must provide reason/comment.
- Admin decision must be audited.
- Critical finance/legal/compliance actions may require `super_admin` later.
- Admin cannot bypass alcohol compliance.
- Admin cannot bypass audit log.
- Admin approval does not replace role, ownership or RLS checks.

## 12. Safe Error Shape

Future safe errors:

```ts
{
  ok: false,
  code:
    | "approval_required"
    | "approval_not_found"
    | "approval_not_pending"
    | "not_authorized"
    | "missing_reason"
    | "server_error",
  message: string
}
```

No raw database errors should be shown in UI.

## 13. Transaction Note

- Approval creation and audit log should be consistent later.
- Approval decision and audit log should be consistent later.
- Critical final action should be tied to approved `approvalId`.
- If audit logging fails for approval decision, the decision should rollback or be marked for admin review.

## 14. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- Alcohol-related request is critical risk.
- Any alcohol-related approval requires legal/admin/`super_admin` review later.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- `super_admin` cannot activate alcohol without legal review, licensing and partner verification.

## 15. Rollback

- Keep mock/demo mode.
- Keep `DATA_SOURCE_MODE=mock`.
- Do not connect approval writes before auth/RLS/audit are ready.
- If approval helper implementation fails later, revert to demo warning mode.
- Run `npm run build`.
- Do not delete mock data.

## 16. Next Stages

Recommended next stages:

1. `12O-1 First Real Write Implementation Preparation`
2. `12P Supabase Auth Implementation Later`
3. `12Q Real Audit Log Helper Implementation Later`

# Audit Log Helper Pseudocode

Stage: 12N-3 - Audit Log Helper Pseudocode.

This document defines future audit log helper logic before implementation. Do not implement audit helper code yet, do not connect Supabase, and do not create real backend writes in this stage.

`DATA_SOURCE_MODE=mock` remains the default. `ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## 1. Goal

- Define future audit log helper logic before implementation.
- Make real backend writes safer.
- Ensure every sensitive action can be traced.
- Support high-risk approval flow later.
- Keep audit writes server-only and consistent with role/RLS checks.

## 2. Future Helper Name

```ts
createAuditLogEntry(input)
```

## 3. Future Input Shape

```ts
{
  actorUserId: string
  actorRole:
    | "client"
    | "partner"
    | "courier"
    | "admin"
    | "super_admin"
    | "ai_dispatcher_system"
  actionType: string
  targetTable: string
  targetId: string
  beforeState?: object
  afterState?: object
  reason?: string
  riskLevel: "low" | "medium" | "high" | "critical"
  humanApprovalRequired?: boolean
  approvalId?: string
}
```

## 4. Future Output Shape

```ts
{
  ok: boolean
  auditLogId?: string
  message: string
}
```

## 5. Pseudocode

### Step 1: Validate Required Fields

Validate:

- `actorUserId`
- `actorRole`
- `actionType`
- `targetTable`
- `targetId`
- `riskLevel`

### Step 2: Validate Risk Level

Allowed risk levels:

- `low`
- `medium`
- `high`
- `critical`

### Step 3: Validate Actor Role

Allowed actor roles:

- `client`
- `partner`
- `courier`
- `admin`
- `super_admin`
- `ai_dispatcher_system`

### Step 4: Sanitize beforeState And afterState

Do not store:

- secrets;
- service role key;
- auth tokens;
- raw payment card data;
- unnecessary private data.

### Step 5: Prepare Audit Record

Prepare:

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

### Step 6: Insert Audit Log Later

Insert audit log in database later through a server-only helper.

### Step 7: Return Safe Result

Return:

- `ok: true`
- `auditLogId`

### Step 8: If Audit Insert Fails

- Return safe error.
- Never expose raw Supabase error.
- For high/critical actions, real business write should rollback or be blocked.

## 6. Transaction Note

- For important writes, target update and audit log should happen together.
- Prefer RPC/database transaction later.
- If audit fails, high/critical write should not be considered complete.
- The first real write pilot should avoid unaudited state transitions.

## 7. Required Usage In Future Real Actions

### Partner

- Mark `ready_for_pickup`.
- Report issue.
- Pause full business.
- Emergency stop.
- Cancellation request.

### Courier

- Report issue.
- Emergency incident.
- Admin support request.
- Delivery status changes if needed.

### Admin

- Assign/reassign courier.
- Force close issue.
- Force complete order.
- Block/unblock partner.
- Block/unblock courier.
- Payment/refund review.
- Role changes.

### AI Dispatcher

- Recommendation created.
- Alert created.
- Decision log created.
- Safety refusal logged.

## 8. Safe Error Shape

Future safe error:

```ts
{
  ok: false,
  code: "audit_validation_failed" | "audit_insert_failed" | "server_error",
  message: string
}
```

No raw database errors should be shown in UI.

## 9. Security Rules

- Service role key is server-only.
- No audit helper in client components.
- Helper used only in server actions/server utilities.
- RLS and role checks still required.
- Audit log table should not be publicly writable.
- Audit log table should not be publicly readable.

## 10. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- Alcohol-related request is critical risk.
- Any alcohol-related audit requires legal/admin review later.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- `super_admin` cannot activate alcohol without legal review, licensing and partner verification.

## 11. Rollback

- Keep mock/demo mode.
- Keep `DATA_SOURCE_MODE=mock`.
- Do not connect audit writes before auth/RLS/schema are ready.
- If audit helper implementation fails later, revert to demo actions.
- Run `npm run build`.
- Do not delete mock data.

## 12. Next Stages

Recommended next stages:

1. `12N-4 High-Risk Approval Helper Pseudocode`
2. `12O-1 First Real Write Implementation Preparation`
3. `12P Supabase Auth Implementation Later`

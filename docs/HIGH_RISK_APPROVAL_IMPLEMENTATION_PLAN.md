# High-Risk Approval Implementation Plan

Stage: 12N-2 - High-Risk Approval Implementation Plan.

This document plans the future high-risk approval flow for real backend actions. Do not implement approval code yet, do not connect Supabase, and do not create real backend writes in this stage.

`DATA_SOURCE_MODE=mock` remains the default. `ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## 1. Goal

- Plan high-risk approval flow for future real actions.
- Prevent automatic execution of dangerous operations.
- Require human admin approval where needed.
- Connect approval flow with audit log later.
- Keep high-risk demo actions as warnings until real auth/RLS/audit are ready.

## 2. Current State

- Demo actions exist.
- High-risk demo actions return `humanApprovalRequired=true`.
- No real approvals yet.
- No real database writes yet.
- No real payment/refund actions yet.
- Mock/demo mode remains the safe fallback.

## 3. High-Risk Approval Table Purpose

Future approval records should store:

- requested action;
- target record;
- requester;
- risk level;
- reason;
- approval status;
- approving admin;
- decision comment;
- audit link.

## 4. Required Approval Fields

- `id`
- `requested_by`
- `requested_role`
- `action_type`
- `target_table`
- `target_id`
- `risk_level`
- `reason`
- `before_state` optional
- `proposed_after_state` optional
- `approval_status`
- `approval_comment`
- `approved_by`
- `rejected_by`
- `created_at`
- `decided_at`
- `audit_log_id` optional

## 5. Approval Statuses

- `pending`
- `approved`
- `rejected`
- `expired`
- `cancelled`

## 6. Risk Levels

- `low`: no approval normally.
- `medium`: audit may be required.
- `high`: approval required for sensitive actions.
- `critical`: approval + stronger review required.

## 7. Actions Requiring Approval

### Orders

- Cancel accepted order.
- Cancel after courier pickup.
- Force complete order.
- Override order status.

### Bookings

- Cancel confirmed booking.
- Override booking status.
- Force no-show.

### Delivery

- Reassign courier after pickup.
- Force close delivery issue.
- Override delivery status.
- Emergency delivery action.

### Finance

- Change payment status.
- Approve refund.
- Cancel payout.
- Manual transaction adjustment.

### Moderation

- Block partner.
- Unblock partner.
- Block courier.
- Unblock courier.
- Role change.
- Platform setting change.

### Compliance

- Alcohol-related request.
- Legal/compliance exception.
- Suspicious activity escalation.

## 8. Approval Flow

1. User/admin/AI recommendation requests high-risk action.
2. System validates role and target.
3. System creates approval request.
4. Action is NOT executed yet.
5. Admin reviews request.
6. Admin approves or rejects with comment.
7. Audit log is created.
8. Only approved action may execute later.
9. Critical actions may require `super_admin`/legal review later.

## 9. AI Dispatcher Restrictions

- AI can recommend high-risk action.
- AI can create alert.
- AI can create decision log.
- AI can create safety refusal log.
- AI cannot approve high-risk action.
- AI cannot execute high-risk action.
- AI cannot cancel order.
- AI cannot change payment.
- AI cannot approve refund.
- AI cannot enable alcohol module.

## 10. Admin Restrictions

- Admin must provide reason/comment.
- Admin decision must be audited.
- Finance/legal/compliance actions may need `super_admin` later.
- Admin cannot bypass alcohol compliance.
- Admin cannot bypass audit log.
- Admin approval does not replace RLS, role checks or ownership checks.

## 11. UI Plan Later

Future admin approval UI should show:

- pending approvals;
- risk level;
- requester;
- target;
- reason;
- AI recommendation if present;
- approve button;
- reject button;
- audit history;
- warning for critical actions.

Do not implement UI now.

## 12. Safety

- High-risk actions must not be executed immediately.
- Payment/refund actions are never direct demo actions.
- Raw database errors must not be shown.
- Service role key must stay server-only.
- RLS and server-side role checks still required.
- Audit log required for every approval decision.

## 13. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- Alcohol-related request is critical risk.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- `super_admin` cannot activate alcohol without legal review, licensing and partner verification.
- Any future alcohol activation requires legal review, licensing, partner verification and `super_admin` approval.

## 14. Rollback

- Keep mock/demo mode.
- Keep `DATA_SOURCE_MODE=mock`.
- Do not connect approvals before auth/RLS/audit are ready.
- If approval implementation fails, revert to demo warning mode.
- Run `npm run build`.
- Do not delete mock data.

## 15. Next Stages

Recommended next stages:

1. `12N-3 Audit Log Helper Pseudocode`
2. `12N-4 High-Risk Approval Helper Pseudocode`
3. `12O-1 First Real Write Implementation Preparation`

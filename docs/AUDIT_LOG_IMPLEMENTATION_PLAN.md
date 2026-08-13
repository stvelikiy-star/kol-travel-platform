# Audit Log Implementation Plan

Stage: 12N-1 - Audit Log Implementation Plan.

This document plans future audit logging for real backend actions. Do not implement audit log code yet, do not connect Supabase, and do not create real backend writes in this stage.

`DATA_SOURCE_MODE=mock` remains the default. `ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## 1. Goal

- Plan audit logging for future real actions.
- Protect high-risk operations.
- Record who did what, when, and why.
- Support admin review and rollback decisions later.
- Keep audit logic ready before the first real write pilot is implemented.

## 2. Current State

- Demo actions exist.
- Demo buttons exist.
- No real writes yet.
- No real audit log writes yet.
- Audit requirements are documented but not implemented.
- Mock/demo mode remains the safe fallback.

## 3. Audit Log Table Purpose

Audit log should record:

- partner operational actions;
- courier delivery actions;
- admin actions;
- AI recommendations/logs where relevant;
- high-risk approvals later;
- payment/refund reviews later.

The audit log is for operational traceability and admin review. It should not become a place for secrets, raw tokens or full payment data.

## 4. Required Audit Log Fields

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
- `approval_id` optional
- `ip_address` later
- `user_agent` later
- `created_at`

## 5. Actions Requiring Audit

### Partner

- Accepted order cancellation request.
- Confirmed booking cancellation request.
- Report issue.
- Pause full business.
- Emergency stop.
- Catalog issue.
- Availability conflict.
- Mark `ready_for_pickup` later as medium audit.

### Courier

- Report issue.
- Wrong order.
- Order damaged.
- Emergency incident.
- Admin support request.
- Delivery status changes later if needed.

### Admin

- Assign courier.
- Reassign courier.
- Resolve issue.
- Force close issue.
- Force complete order.
- Block/unblock partner.
- Block/unblock courier.
- Payment review.
- Refund request.
- Role change.
- Platform settings change.

### AI Dispatcher

- Recommendation created.
- Alert created.
- Decision log created.
- Safety refusal logged.

## 6. Risk Levels

- `low`: normal info/action.
- `medium`: operational change or delay.
- `high`: blocked order, cancellation request, moderation, reassignment.
- `critical`: payment, refund, force complete, legal/compliance, alcohol-related request.

## 7. Audit Creation Rule

For real write actions:

1. Validate auth.
2. Validate role.
3. Validate ownership.
4. Validate status transition.
5. Prepare `before_state`.
6. Perform safe write.
7. Prepare `after_state`.
8. Create audit log.
9. Return safe response.

Audit creation should happen server-side and should never depend on client-submitted role or ownership claims.

## 8. Transaction Requirement

- Important writes should update target record and audit log together.
- Prefer transaction/RPC for critical actions later.
- If audit log fails after high-risk write, action should rollback or be marked for admin review.
- The first real write pilot should avoid unaudited state transitions.

## 9. Safe Storage

- `before_state` and `after_state` should not store secrets.
- Do not store service role key.
- Do not store full payment card data.
- Do not store raw private auth tokens.
- Store only operationally needed fields.
- Redact private data before writing audit state snapshots.

## 10. Admin Visibility Later

Plan future admin audit page:

- filter by `action_type`;
- filter by `actor_role`;
- filter by `risk_level`;
- filter by `target_id`;
- show before/after summary;
- show reason;
- show approval link if exists.

Do not implement admin audit page now.

## 11. AI Limitations

- AI can create recommendation/alert/log.
- AI cannot approve high-risk action.
- AI cannot cancel orders.
- AI cannot change payment.
- AI cannot approve refunds.
- AI cannot enable alcohol module.
- AI safety refusal should be logged later.

## 12. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- Alcohol-related request is critical risk.
- Any alcohol-related audit must require legal/admin review later.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- `super_admin` cannot activate alcohol without legal review, licensing and partner verification.

## 13. Rollback

- Keep mock/demo mode.
- Keep `DATA_SOURCE_MODE=mock`.
- Do not connect audit writes before schema/RLS/auth are ready.
- If audit implementation fails, revert to demo actions.
- Run `npm run build`.
- Do not delete mock data.

## 14. Next Stages

Recommended next stages:

1. `12N-2 High-Risk Approval Implementation Plan`
2. `12N-3 Audit Log Helper Pseudocode`
3. `12O-1 First Real Write Implementation Preparation`

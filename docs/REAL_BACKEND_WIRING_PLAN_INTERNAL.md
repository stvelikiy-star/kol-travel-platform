# Real Backend Wiring Plan Internal

Stage: 12I-4 - Real Backend Wiring Plan.

This document defines the future strategy for wiring internal operations to a real backend. Supabase is not connected in this stage, no real backend writes are created, UI behavior is unchanged, and mock data is not mutated.

`ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## 1. Current State

- The app runs in mock mode.
- `DATA_SOURCE_MODE=mock` is the safe default.
- Internal partner, courier, admin and AI demo actions exist.
- Pilot demo buttons exist for selected internal flows.
- `DemoActionResultPanel` exists and displays demo action feedback.
- No real database writes are connected.
- No real auth is connected.
- No real payments are connected.
- No Telegram or n8n notifications are connected yet.
- Demo actions do not mutate mock data.

## 2. Backend Wiring Principle

Backend wiring must be incremental.

- Do not wire everything at once.
- Start with one safe low-risk or medium-risk pilot.
- Validate auth before every write.
- Validate role before every write.
- Validate ownership before every write.
- Validate RLS behavior before enabling broad usage.
- Write audit logs for sensitive actions.
- Expand by role and action group only after the pilot is stable.
- Keep rollback to `DATA_SOURCE_MODE=mock`.
- Keep mock data and demo actions until real actions are stable.

## 3. Recommended First Real Pilot

Recommended first real pilot:

`partner marks order ready_for_pickup`

Future real action:

`markOrderReadyForPickupAction(orderId)`

Why this is a good first pilot:

- operationally important;
- medium/low risk;
- does not involve payment;
- does not cancel order;
- does not require refund;
- has a clear status transition;
- easy to audit;
- creates a useful handoff signal for delivery.

Required checks:

- user is authenticated;
- user role is `partner`;
- order belongs to partner;
- order status is `accepted_by_partner` or `preparing`;
- payment status is not modified;
- audit log is created;
- notification can be added later;
- delivery/courier system is not forced to complete anything.

Target tables:

- `orders`;
- `order_status_history`;
- `audit_logs`;
- later `notifications` or `ai_alerts`.

## 4. Partner Wiring Order

Suggested sequence:

1. `markOrderReadyForPickupAction`
2. `markOrderPreparingAction`
3. `acceptPartnerOrderAction`
4. `rejectPartnerOrderAction`
5. `reportPartnerOrderIssueAction`
6. `pauseFutureOrdersAction`
7. `pauseCatalogItemAction`
8. `blockAvailabilityDateAction`

High-risk partner actions later:

- accepted order cancellation request;
- confirmed booking cancellation request;
- emergency stop;
- broad category or business stop with active workload.

Partner real wiring requirements:

- role: `partner`;
- ownership: target record belongs to authenticated partner;
- RLS: partner can read/write only allowed partner-owned records;
- audit: yes for issue, stop, cancellation and availability conflict actions;
- human approval: yes for high-risk cancellation/emergency flows;
- notifications: later for client/admin/courier-facing changes.

## 5. Courier Wiring Order

Suggested sequence:

1. `acceptDeliveryAction`
2. `markCourierToPartnerAction`
3. `markPickedUpAction`
4. `markCourierToClientAction`
5. `markDeliveredAction`
6. `reportClientNotAnsweringAction`
7. `reportPartnerNotReadyAction`
8. `requestAdminSupportAction`

High-risk courier actions later:

- emergency incident;
- order damaged;
- admin support escalation;
- reassignment request after pickup.

Courier real wiring requirements:

- role: `courier`;
- assignment check: delivery is assigned to courier or available by rules;
- target tables: `deliveries`, `delivery_status_history`, `delivery_issues`, `courier_assignments`;
- audit: yes for issue reports and exceptional transitions;
- human approval: yes for critical incidents and blocked deliveries;
- notifications: later for admin/partner/client status updates.

## 6. Admin Wiring Order

Suggested sequence:

1. `markDeliveryAdminReviewAction`
2. `assignCourierAction`
3. `classifyIssueSeverityAction`
4. `resolveIssueAction`
5. `reassignCourierAction`
6. `blockPartnerAction`
7. `blockCourierAction`

High-risk admin actions later:

- force complete order;
- payment status change;
- refund approval;
- role change;
- legal/compliance cases;
- cancellation after courier pickup.

Admin real wiring requirements:

- role: `admin` or `super_admin`;
- permission check by action type;
- high-risk approval requirement;
- audit log requirement;
- target tables: `deliveries`, `delivery_issues`, `courier_assignments`, `partners`, `courier_profiles`, `payments`, `refunds`, `user_roles`;
- safety restriction: no payment/refund/cancellation/force-complete without approval and audit.

## 7. AI Dispatcher Wiring Order

Suggested sequence:

1. `createDelayAlertAction`
2. `createAiDecisionLogAction`
3. `recommendCourierAssignmentAction`
4. `recommendCourierReassignmentAction`
5. `recommendIssueEscalationAction`
6. `createAiSafetyRefusalLogAction`

AI restrictions:

- AI never executes high-risk actions;
- AI recommendations require admin review when high or critical;
- AI cannot cancel orders;
- AI cannot change payment status;
- AI cannot approve refunds;
- AI cannot block or unblock users;
- AI cannot force-complete orders;
- AI cannot enable alcohol module.

AI target tables:

- `ai_recommendations`;
- `ai_alerts`;
- `ai_decision_logs`;
- later `notifications` for human-reviewed alerts only.

## 8. Required Database Tables Before Real Wiring

Likely required tables:

- `users` / auth users;
- `user_profiles`;
- `user_roles`;
- `partners`;
- `courier_profiles`;
- `orders`;
- `order_items`;
- `order_status_history`;
- `bookings`;
- `booking_status_history`;
- `deliveries`;
- `delivery_status_history`;
- `delivery_issues`;
- `catalog_items` or split catalog tables;
- `availability_rules`;
- `audit_logs`;
- `high_risk_approvals`;
- `ai_recommendations`;
- `ai_alerts`;
- `ai_decision_logs`.

Before wiring, each write path must know:

- target table;
- allowed role;
- ownership relation;
- status transition;
- audit requirement;
- approval requirement.

## 9. Audit Log Requirement

Every real write should record:

- `actor_user_id`;
- `actor_role`;
- `action_type`;
- `target_table`;
- `target_id`;
- `before_state`;
- `after_state`;
- `reason`;
- `risk_level`;
- `created_at`.

High-risk actions should also record:

- approval request ID;
- approval status;
- approving admin;
- decision comment;
- decided timestamp.

## 10. Rollback Plan

Rollback must stay simple.

- Keep mock mode available.
- If Supabase wiring breaks, set `DATA_SOURCE_MODE=mock`.
- Do not delete mock data.
- Do not remove demo actions until real actions are stable.
- Do not remove demo UI feedback until production feedback exists.
- Keep read adapters able to fall back safely.

Rollback command in env:

```env
DATA_SOURCE_MODE=mock
```

## 11. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol through demo or real actions.
- Any future activation requires legal review, licensing, partner verification and `super_admin` approval.
- Alcohol-related request is critical risk.
- Alcohol-related approval must be audited.

## 12. Recommended Next Stages

Suggested sequence:

1. `12J-1 Supabase Test Project Setup Checklist`
2. `12J-2 SQL Schema Application Checklist`
3. `12J-3 RLS Verification Checklist`
4. `12K-1 Real Read Adapter Validation`
5. `12L-1 First Real Write Pilot: Partner Ready For Pickup`

Real write implementation should begin only after auth, RLS, audit logging and rollback checks are verified in a test Supabase project.

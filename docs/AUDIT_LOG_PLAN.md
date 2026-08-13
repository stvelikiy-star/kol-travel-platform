# Audit Log Plan

## Статус Stage 12D-3

Документ описывает будущий audit logging для чувствительных действий в KOL / Issyk-Kul Travel & Delivery Platform. На этом этапе код не реализуется, server actions не создаются, Supabase writes не выполняются.

## Цель Audit Log

Audit log нужен для прозрачности, расследования инцидентов, финансового контроля, moderation history и compliance-sensitive действий. Любое действие, которое меняет деньги, роли, доступность, статусы заказов/броней, доставку, настройки платформы или legal-sensitive модули, должно оставлять след.

## Actions Requiring Audit Log

Audit log обязателен для:

- order cancellation;
- booking cancellation;
- payment status change;
- refund;
- courier assignment;
- courier reassignment;
- delivery status override;
- partner stop-business action;
- partner stop-item action;
- catalog moderation;
- partner verification;
- courier blocking;
- role changes;
- platform settings changes;
- high-risk AI approval;
- alcohol module compliance review.

## Audit Log Fields

Будущая таблица `audit_logs` должна включать:

| Field | Purpose |
|---|---|
| `id` | Unique audit log record ID. |
| `actor_user_id` | User/system actor who initiated the action. |
| `actor_role` | Role at the moment of action. |
| `action_type` | Stable action code, for example `order.cancelled_by_admin`. |
| `target_table` | Table/entity affected by the action. |
| `target_id` | Target record ID. |
| `before_state` | JSON snapshot of important fields before action. |
| `after_state` | JSON snapshot of important fields after action. |
| `reason` | Human-readable reason or required business reason. |
| `risk_level` | `low`, `medium`, `high`, or `critical`. |
| `human_approval_required` | Whether action required explicit human approval. |
| `approved_by` | Admin/super admin ID when approval is required. |
| `ip_address` | Added later after real request context exists. |
| `user_agent` | Added later after real request context exists. |
| `created_at` | Immutable creation timestamp. |

## Risk Levels

- `low` - routine profile/catalog change with limited impact.
- `medium` - status or availability change that can affect customers/partners.
- `high` - cancellation, reassignment, dispute, moderation rejection, courier blocking.
- `critical` - payment/refund changes, role changes, platform settings, alcohol compliance activation/review.

## Core Rules

- AI recommendations are logged separately in AI tables.
- AI recommendation does not replace human audit log.
- High-risk actions require admin approval.
- Finance actions require audit log.
- Payment status changes require strict audit.
- Accepted orders/bookings require audit before cancellation.
- Service role key must never be exposed to browser.
- Audit logs must be append-only for normal application users.
- Deleting or editing audit logs should be impossible through ordinary dashboards.

## Order And Booking Cancellation

Audit required before any accepted order or booking is cancelled.

Must capture:

- current status;
- cancellation reason;
- actor role;
- client/partner impact;
- whether refund or support ticket is needed;
- approval identity if cancellation is high-risk.

Rules:

- Partner cannot cancel accepted booking/order without admin rules.
- Courier cannot cancel order.
- AI cannot cancel order or booking.

## Payment And Refund Audit

Payment status changes and refunds are strict audit events.

Must capture:

- previous payment status;
- new payment status;
- amount;
- currency;
- related order/booking;
- finance admin or super admin approval;
- reason and evidence reference later.

Rules:

- AI never changes payment status.
- Courier never changes payment status.
- Partner never changes payment status.
- Finance actions require human/admin approval.

## Delivery And Courier Audit

Audit required for:

- courier assignment;
- courier reassignment;
- delivery status override by admin;
- delivery issue resolution;
- courier blocking or suspension.

Rules:

- Courier can update physical delivery statuses only for assigned deliveries.
- Admin can override delivery statuses only with reason.
- AI can recommend reassignment but cannot execute high-risk reassignment without approval.

## Partner And Catalog Audit

Audit required for:

- partner verification approval/rejection;
- catalog moderation approval/rejection;
- stop-business;
- stop-item/product/room/tour;
- suspicious content moderation.

Rules:

- Stop-business does not cancel accepted orders/bookings.
- Stop-item blocks only new orders/bookings.
- Closing dates blocks only new bookings.
- Moderation actions must record reason and actor.

## Role And Settings Audit

Audit required for:

- role assignment/removal;
- user blocking/suspension;
- platform settings;
- feature flags;
- compliance settings.

Rules:

- Role changes require super admin or explicit admin policy.
- Settings changes require audit even if low-risk.
- `ALCOHOL_MODULE_ENABLED` must remain false by default and locked until compliance is approved.

## AI Audit Relationship

AI dispatcher tables store:

- `ai_recommendations`;
- `ai_alerts`;
- `ai_decision_logs`.

These are not a replacement for `audit_logs`.

If a human admin approves an AI recommendation, the platform must write:

1. AI recommendation/decision log.
2. Human audit log with `approved_by`.
3. Target entity status/history log if applicable.

## Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales/delivery disabled.
- Activation requires legal review and `super_admin` approval.
- AI cannot enable alcohol module.
- Any alcohol-related review must be audited.
- Alcohol compliance review must include legal approval status, partner license verification, age-gate requirements and admin approval trail.

## Before Implementation

1. Finalize `audit_logs` schema.
2. Define stable `action_type` enum/list.
3. Add server-only audit writer.
4. Add audit writer to future server actions.
5. Test RLS so users cannot read unrelated sensitive audit records.
6. Verify service role key remains server-only.

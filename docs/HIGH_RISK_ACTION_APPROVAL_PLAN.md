# High-Risk Action Approval Plan

## Статус Stage 12D-4

Документ описывает будущий approval flow для high-risk actions в KOL / Issyk-Kul Travel & Delivery Platform. На этом этапе код не реализуется, server actions не создаются, Supabase writes не выполняются.

## Цель

High-risk approval нужен для действий, которые могут повлиять на деньги, права пользователей, статусы принятых заказов/броней, доставку, партнеров, платформенные настройки или compliance-sensitive модули.

## High-Risk Actions

### Orders

Approval required for:

- cancel accepted order;
- cancel order after courier pickup;
- override order status;
- force-complete order;
- force-refund order.

Правила:

- Accepted order нельзя отменять без причины и audit log.
- После courier pickup отмена требует admin review.
- AI не может отменить заказ или force-complete order.
- Payment/refund changes требуют finance/admin approval.

### Bookings

Approval required for:

- cancel confirmed booking;
- override booking status;
- force no-show;
- change booking dates after confirmation;
- manual availability override.

Правила:

- Confirmed booking нельзя отменять без admin rules.
- Изменение дат после подтверждения требует проверки доступности и причины.
- Manual availability override должен учитывать уже принятые брони.

### Delivery

Approval required for:

- reassign courier after pickup;
- override delivery status;
- mark delivered manually;
- close delivery problem;
- block courier;
- unblock courier.

Правила:

- Courier controls physical delivery only.
- Admin can override delivery status only with reason.
- AI can recommend reassignment but cannot execute high-risk delivery action.

### Finance

Approval required for:

- change payment status;
- approve refund;
- change commission;
- create payout;
- cancel payout;
- manual transaction adjustment.

Правила:

- Finance actions require strict audit log.
- Payment status changes require explicit finance/admin rules.
- Service role key must never be exposed to browser.
- AI cannot change payment status.

### Partner/Admin

Approval required for:

- block partner;
- unblock partner;
- stop entire business;
- approve suspicious catalog item;
- hide catalog item;
- change partner verification status;
- change user role;
- change platform settings.

Правила:

- Stop business не отменяет accepted orders/bookings.
- Suspicious catalog item approval must be logged.
- Role changes require super admin policy.
- Platform settings changes always require audit.

### AI Dispatcher

AI dispatcher permissions:

- AI can recommend action;
- AI can create alert;
- AI can draft message.

AI dispatcher restrictions:

- AI cannot approve high-risk action;
- AI cannot execute cancellation;
- AI cannot change payment status;
- AI cannot enable alcohol module.

## Approval Flow

1. Action requested.
2. Risk level calculated.
3. AI/admin recommendation created.
4. Human admin reviews.
5. Reason is required.
6. Approval or rejection is logged.
7. Audit log is created.
8. Notification is sent later.

## Risk Levels

| Risk level | Who can approve | Audit required | Second approval required | Notification later |
|---|---|---|---|---|
| `low` | Owning role or manager, depending on action | Optional/limited | No | Optional |
| `medium` | Partner owner, support admin, dispatcher or scoped admin | Yes | No | Yes for customer-impacting actions |
| `high` | Support admin, finance admin, dispatcher or super admin | Yes | Sometimes | Yes |
| `critical` | Super admin or explicit dual approval policy | Yes | Yes for finance/compliance/settings | Yes |

## Required Approval Fields

Future approval records should include:

| Field | Purpose |
|---|---|
| `id` | Unique approval request ID. |
| `requested_by` | User/system that requested the action. |
| `requested_role` | Role of requester at the time of request. |
| `action_type` | Stable action code. |
| `target_table` | Affected table/entity. |
| `target_id` | Affected record ID. |
| `risk_level` | `low`, `medium`, `high`, or `critical`. |
| `reason` | Required business/compliance reason. |
| `ai_recommendation_id` | Optional related AI recommendation. |
| `approved_by` | Human admin who approved/rejected. |
| `approval_status` | `pending`, `approved`, `rejected`, `expired`, `cancelled`. |
| `approval_comment` | Admin decision comment. |
| `created_at` | Request creation timestamp. |
| `decided_at` | Decision timestamp. |

## Audit Relationship

Approval records do not replace audit logs.

For approved/rejected high-risk actions, the system must create:

1. Approval request record.
2. AI recommendation/alert/decision log if AI was involved.
3. Human audit log with before/after state.
4. Domain status history record where applicable.

## Safe Error Handling

Approval flow must return safe errors only:

- no stack traces;
- no raw SQL;
- no service role key;
- no unrelated user data;
- no internal policy details that leak access rules.

## Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales/delivery disabled.
- Activation requires legal review, license verification, partner verification and `super_admin` approval.
- AI cannot enable alcohol module.
- Any alcohol-related approval must be treated as `critical` risk.
- Alcohol compliance review must include audit log, legal status, partner license verification and explicit super admin decision.

## Not Implemented Yet

This document is planning only. It does not add:

- real approval tables;
- server actions;
- Supabase writes;
- auth checks;
- payment actions;
- Telegram/n8n notifications;
- alcohol module activation.

# Admin Delivery Control UX

Stage: 12E-INTERNAL-7 — Admin Delivery Control UX.

This document describes admin delivery control UX for partner/courier operations. It is demo and planning only. No backend, Supabase writes, payments, Telegram/n8n, notifications, or real admin actions are connected.

`ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## Admin Delivery Control Flow

The admin delivery control flow should show these stages:

1. New order.
2. Accepted by partner.
3. Preparing.
4. Ready for pickup.
5. Courier assigned.
6. Courier going to partner.
7. Picked up.
8. Courier going to client.
9. Delivered.
10. Issue reported.
11. Admin required.

Admin delivery UI should make visible:

- `Контроль доставки`;
- `Заказы требуют внимания`;
- `Готово к выдаче`;
- `Курьер не назначен`;
- `Курьер задерживается`;
- `Партнёр не готов`;
- `Клиент не отвечает`;
- `Проблема на маршруте`;
- `Нужна ручная проверка`;
- `AI-диспетчер рекомендует`;
- `Высокий риск`.

## Stuck Order Cases

Admin should be able to review demo signals for:

- partner has not accepted order;
- partner is preparing too long;
- order is ready for pickup but no courier is assigned;
- courier assigned but not accepted;
- courier is delayed going to partner;
- pickup is delayed;
- courier is delayed going to client;
- client is not reachable;
- delivery issue needs admin review.

## Partner/Courier Handoff Monitoring

Admin monitors the operational handoff:

- partner accepts or rejects order;
- partner prepares order;
- partner marks ready for pickup;
- admin/AI dispatcher reviews courier assignment;
- courier goes to partner;
- courier picks up order;
- courier goes to client;
- courier marks delivered;
- admin handles exceptions.

Partner controls preparation only. Courier controls physical delivery only. Admin controls disputes, reassignment, and high-risk exceptions.

## What Admin Can Do In Demo UX

Admin can:

- view stuck orders;
- view partner readiness;
- view courier assignment state;
- view delivery issue severity;
- review AI recommendation;
- decide whether manual action is needed;
- prepare future courier reassignment;
- prepare future issue resolution.

Current UI remains demo-only and does not mutate data.

## High-Risk Admin Actions

These actions require audit later:

- cancel accepted order;
- cancel after pickup;
- change payment status;
- approve refund;
- force complete order;
- force close delivery issue;
- reassign courier after pickup;
- block partner;
- block courier;
- alcohol-related request.

Future implementation must require human admin approval, reason, risk level, before/after state, and audit log.

## AI Dispatcher Limitations

AI dispatcher can:

- detect delays;
- classify issue severity;
- recommend reassignment;
- draft messages;
- alert admin.

AI dispatcher cannot:

- cancel order;
- change payment status;
- approve refund;
- enable alcohol module.

Critical actions require human admin approval. AI recommendations are not approvals.

## Risk Levels

- `low`: information only.
- `medium`: delay or clarification.
- `high`: order/delivery blocked.
- `critical`: payment, refund, cancellation, safety, legal, alcohol compliance.

Critical risk must be reviewed by a human admin and must be audited later.

## Audit Requirements Later

Future audit logs must capture:

- actor;
- role;
- action type;
- target order/delivery;
- risk level;
- reason;
- AI recommendation ID when present;
- approval status;
- before/after state;
- timestamp.

Audit is required for payment changes, refunds, cancellations, courier reassignment after pickup, force completion, force issue closure, partner/courier blocking, and alcohol-related requests.

## Future Backend Actions

Future backend actions may include:

- assign courier;
- reassign courier;
- close delivery issue;
- escalate issue;
- contact partner/client/courier via notifications;
- approve or reject high-risk action;
- create audit log;
- create AI dispatcher event;
- create admin alert.

Before real actions are connected, backend must validate auth, admin role, RLS, audit requirements, high-risk approval, and compliance state.

## Alcohol Module Disabled

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- AI cannot enable alcohol module.
- Any future alcohol activation requires legal review, licensing, partner verification, and `super_admin` approval.
- Any alcohol-related request is critical risk and admin/legal review only.

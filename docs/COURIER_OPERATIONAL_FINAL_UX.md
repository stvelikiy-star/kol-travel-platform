# Courier Operational Final UX

Stage: 12E-INTERNAL-6 — Courier Operational Final UX.

This document describes the final demo UX rules for courier operations before real backend, auth, GPS, payments, notifications, and dispatcher automation are connected.

`ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## Courier Workflow

The courier workflow should be visible and consistent across courier pages:

1. Available delivery.
2. Accept delivery.
3. Go to partner.
4. Arrive at partner.
5. Pick up order.
6. Go to client.
7. Arrive at client.
8. Mark delivered.
9. Report issue if needed.
10. Admin/AI dispatcher handles exceptions.

The UI should expose clear blocks for:

- `Доступные доставки`;
- `Активная доставка`;
- `Следующий шаг`;
- `Маршрут`;
- `Точка партнёра`;
- `Точка клиента`;
- `Ожидает забора`;
- `Забрал заказ`;
- `В пути к клиенту`;
- `Доставлено`;
- `Проблема на доставке`;
- `Связаться с админом`;
- `AI-диспетчер`.

## Courier Responsibility Zone

Courier can:

- accept available delivery;
- update physical delivery progress;
- report issue;
- contact admin;
- follow AI dispatcher recommendation;
- view route and next step;
- view earnings/history.

Courier cannot:

- change payment status;
- change order items;
- cancel order without admin;
- approve refund;
- edit partner preparation status;
- enable alcohol module.

Courier responsibility starts when a delivery is assigned or accepted and covers physical movement from partner pickup to client delivery.

## Issue Handling

The courier should see clear next actions for:

- partner not ready;
- wrong order given;
- client not answering;
- wrong address;
- traffic delay;
- vehicle problem;
- order damaged;
- client refused order;
- emergency incident.

Recommended demo behavior:

- partner not ready: wait briefly, report issue, contact admin;
- wrong order given: do not pick up, report partner issue;
- client not answering: call demo contact, wait, escalate;
- wrong address: request admin/client clarification;
- traffic delay: update route issue and continue safely;
- vehicle problem: report high severity and request reassignment;
- order damaged: stop handoff and escalate admin;
- client refused order: report issue, do not refund manually;
- emergency incident: critical risk, human admin required.

## Admin Escalation Cases

Admin is required for:

- order cancellation;
- payment status change;
- refund request;
- delivery status override;
- courier reassignment after pickup;
- damaged order dispute;
- client refused order;
- emergency or safety incident;
- legal/compliance issue;
- alcohol-related request.

Future implementation must require reason, risk level, human approval for high-risk cases, and audit log.

## AI Dispatcher Limitations

AI dispatcher can:

- recommend next step;
- detect delay;
- classify issue severity;
- alert admin;
- draft message.

AI dispatcher cannot:

- cancel order;
- change payment status;
- approve refund;
- enable alcohol module.

Critical issues require human admin approval. AI recommendations are not approvals.

## Earnings Demo Mode

Courier earnings and history pages are demo-only.

Current UI may show:

- completed deliveries;
- base delivery fee demo;
- distance bonus demo;
- peak hour bonus demo;
- pending payout demo.

Payment and payout calculations are future backend logic. Courier cannot manually change payout status or payment status.

## Future Backend Actions

Future write actions may include:

- accept delivery;
- update delivery progress;
- mark picked up;
- mark delivered;
- report delivery issue;
- update courier status;
- record GPS route;
- calculate earnings;
- request payout;
- create audit logs for sensitive actions.

Before real actions are connected, the backend must validate auth, courier ownership/assignment, role, RLS, issue severity, and audit requirements.

## Alcohol Module Disabled

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- Courier cannot enable alcohol module.
- AI cannot enable alcohol module.
- Any future alcohol activation requires legal review, licensing, partner verification, and `super_admin` approval.
- Any alcohol-related request is critical risk.

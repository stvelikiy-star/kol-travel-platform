# Internal Operations Final Audit

Stage: 12E-INTERNAL-8 — Internal Operations Final Audit.

This document records the final UX audit for internal operations across partner, courier, admin delivery control, and AI dispatcher demo flows. It is documentation and UI audit only. No backend, Supabase writes, payments, Telegram/n8n, real actions, or auth are connected.

`ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## Final Internal Operation Flow

The internal operation flow is:

1. Partner receives order.
2. Partner accepts or rejects.
3. Partner prepares.
4. Partner marks `ready_for_pickup` / `Готов к выдаче`.
5. Courier is assigned.
6. Courier goes to partner.
7. Courier picks up order.
8. Courier goes to client.
9. Courier delivers.
10. Admin controls exceptions.
11. AI dispatcher recommends but does not execute high-risk actions.

Consistent visible operation wording should remain:

- `Готов к выдаче`;
- `Ожидает курьера`;
- `Курьер назначен`;
- `Курьер забрал заказ`;
- `Доставлено`;
- `Нужен админ`;
- `Demo режим: изменения пока не сохраняются`.

## Partner Responsibility

Partner controls:

- preparation;
- availability;
- catalog status;
- stop button for future demand;
- future orders/bookings pause;
- ready-for-pickup handoff.

Partner can:

- accept new order;
- reject new order before acceptance;
- mark preparing;
- mark ready for pickup;
- pause future orders/bookings;
- stop one item, category, date, or slot;
- report issue.

Partner cannot:

- change payment status;
- force refund;
- cancel accepted order without admin;
- cancel confirmed booking without admin;
- cancel after courier pickup;
- enable alcohol module.

Partner UX coverage:

- `/partner`: overview, operational status, quick actions.
- `/partner/orders`: order status actions and partner preparation boundary.
- `/partner/delivery`: partner-to-courier handoff and ready-for-pickup rules.
- `/partner/stop`: stop button scope and accepted work protection.
- `/partner/availability`: future availability controls and admin escalation.
- `/partner/catalog`: item/category stop rules and accepted work protection.

## Courier Responsibility

Courier controls:

- physical delivery;
- route progress;
- pickup confirmation;
- client delivery confirmation;
- issue reporting;
- route/next-step visibility.

Courier can:

- accept available delivery;
- update physical delivery progress;
- report issue;
- contact admin;
- follow AI dispatcher recommendation;
- view route/next step;
- view earnings/history.

Courier cannot:

- change payment status;
- change order items;
- cancel order without admin;
- approve refund;
- edit partner preparation status;
- enable alcohol module.

Courier UX coverage:

- `/courier`: dashboard operational workflow.
- `/courier/deliveries`: available deliveries, risks, and detail links.
- `/courier/active`: active route and delivery progress.
- `/courier/issues`: issue classification and admin escalation.
- `/courier/dispatcher`: AI dispatcher rules.
- `/courier/earnings`: demo-only earnings and payout restrictions.

## Admin Responsibility

Admin controls exceptions:

- stuck orders;
- partner readiness problems;
- courier assignment problems;
- delivery issue severity;
- high-risk manual review;
- future courier reassignment;
- future issue resolution;
- disputes and blocked operational flows.

Admin can:

- view stuck orders;
- view partner readiness;
- view courier assignment state;
- view delivery issue severity;
- review AI recommendation;
- decide whether manual action is needed;
- prepare future courier reassignment;
- prepare future issue resolution.

Future real admin actions require auth, role checks, ownership/RLS, approval flow, and audit logs.

Admin UX coverage:

- `/admin/delivery`: delivery control center and high-risk action boundaries.
- `/admin/ai-dispatcher`: AI decision fields, time rules, risk levels, and human approval.

## AI Dispatcher Limits

AI dispatcher can:

- recommend next action;
- classify severity;
- alert admin;
- draft message;
- detect delays;
- suggest courier reassignment.

AI dispatcher cannot:

- cancel order;
- change payment status;
- approve refund;
- force complete order;
- force close delivery issue;
- enable alcohol module.

AI recommendations do not replace human approval. Critical and high-risk actions require admin review and future audit logs.

## High-Risk Actions

High-risk actions requiring admin approval and future audit:

- accepted order cancellation;
- confirmed booking cancellation;
- cancellation after courier pickup;
- payment status change;
- refund approval;
- force-complete order;
- force-close delivery issue;
- courier reassignment after pickup;
- partner block;
- courier block;
- legal/compliance issue;
- alcohol-related request.

## Alcohol Module Disabled

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- AI cannot enable alcohol module.
- Partner cannot enable alcohol module.
- Courier cannot enable alcohol module.
- Any alcohol-related request is critical risk and admin/legal review only.
- Any future alcohol activation requires legal review, licensing, partner verification, and `super_admin` approval.

## Future Backend Actions

Future backend work may connect:

- partner order actions;
- partner availability and stop scope writes;
- courier delivery progress writes;
- courier issue reports;
- admin delivery control actions;
- AI dispatcher recommendation logs;
- audit logs;
- notifications;
- GPS and courier assignment;
- payout/earning calculations.

Before enabling real actions, the platform must validate auth, roles, ownership, RLS, high-risk approvals, audit log requirements, and compliance state.

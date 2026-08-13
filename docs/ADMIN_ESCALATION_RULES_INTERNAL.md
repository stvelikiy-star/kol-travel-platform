# Admin Escalation Rules Internal

Stage: 12E-INTERNAL-4C — Admin Escalation Rules Summary.

This document is a short shared escalation summary for partner and courier internal operations. It is planning and UX guidance only. No backend, Supabase writes, payments, Telegram/n8n, or real actions are connected.

`ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## When Admin Is Required

Admin review and approval are required for:

- accepted order cancellation;
- order cancellation after courier pickup;
- confirmed booking cancellation;
- payment status change;
- refund request;
- suspicious partner behavior;
- suspicious client behavior;
- courier reassignment after pickup;
- legal or compliance issue;
- emergency incident;
- alcohol-related request;
- force-complete order;
- force-close delivery issue;
- full business emergency stop.

## Partner Can Do Without Admin

Partner demo actions that can be shown without admin approval:

- accept new order;
- reject new order before acceptance;
- mark preparing;
- mark ready_for_pickup;
- pause future orders;
- pause future bookings;
- stop one item, date, or slot;
- report issue.

These actions remain demo-only until real backend actions, role checks, ownership checks, RLS, audit logs, and notifications are connected.

## Courier Can Do Without Admin

Courier demo actions that can be shown without admin approval:

- accept available delivery;
- mark going to partner;
- mark picked up;
- mark going to client;
- mark delivered;
- report issue.

Courier actions cover physical delivery progress only. They do not change payments, order contents, or legal/compliance state.

## Partner Cannot Do Without Admin

Partner cannot do the following without admin approval:

- cancel accepted order;
- cancel confirmed booking;
- change payment status;
- force refund;
- cancel after pickup;
- enable alcohol module.

Accepted orders and confirmed bookings require admin rules before cancellation. Stop button actions block future requests only and do not cancel already accepted orders or bookings.

## Courier Cannot Do Without Admin

Courier cannot do the following without admin approval:

- cancel order;
- change payment status;
- change order items;
- reassign himself after pickup;
- force refund;
- enable alcohol module.

If a courier cannot complete a delivery, the correct demo path is to report an issue and request admin support.

## AI Dispatcher Limitations

AI dispatcher can:

- recommend next action;
- classify issue severity;
- alert admin;
- draft message for partner, courier, client, or admin.

AI dispatcher cannot:

- approve high-risk action;
- cancel order;
- change payment status;
- approve refund;
- enable alcohol module.

AI suggestions do not replace human approval. Critical and high-risk actions require admin review and an audit log later.

## Risk Levels

- `low`: information only.
- `medium`: delay or clarification.
- `high`: blocked order or blocked delivery.
- `critical`: payment, refund, cancellation, safety, legal, or alcohol compliance risk.

Critical risks must be escalated to a human admin. Future implementation must require reason, approval status, approver identity, and audit log entries.

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- AI cannot enable alcohol module.
- Any future alcohol activation requires legal review, licensing, partner verification, and `super_admin` approval.
- Any alcohol-related request is `critical` risk.

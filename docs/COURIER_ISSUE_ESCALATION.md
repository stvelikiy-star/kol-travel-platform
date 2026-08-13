# Courier Issue Escalation

## Статус Stage 12E-INTERNAL-4B

Документ описывает courier-only demo UX для сообщений о проблемах и escalation. Реальных backend actions, Supabase writes, payments, Telegram/n8n и auth на этом этапе нет.

## Courier Issue Cases

Курьер может сообщить проблему, если:

- partner is not ready;
- partner gave wrong order;
- courier cannot find partner location;
- courier cannot contact client;
- client refuses order;
- client address problem;
- traffic delay;
- vehicle problem;
- accident/emergency;
- payment issue;
- order damaged;
- delivery route blocked;
- courier needs admin support.

## Issue Severity Levels

- `low`: information only.
- `medium`: delay or clarification.
- `high`: delivery blocked.
- `critical`: safety, payment, cancellation, refund, legal/compliance risk.

## Что может делать курьер

- Courier can report issue.
- Courier can request admin help.
- Courier can update physical delivery progress.

## Что нельзя делать курьеру

- Courier cannot change payment status.
- Courier cannot change order items.
- Courier cannot cancel order without admin.
- Courier cannot enable alcohol module.

## AI Dispatcher Rules

AI can:

- classify issue severity;
- recommend next action;
- alert admin;
- draft message.

AI cannot:

- cancel order;
- approve refund;
- change payment;
- enable alcohol module.

Critical issues require human admin.

## Alcohol Module Disabled

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales/delivery disabled.
- AI cannot enable alcohol module.
- Any future alcohol activation requires legal review, licensing, partner verification and super_admin approval.

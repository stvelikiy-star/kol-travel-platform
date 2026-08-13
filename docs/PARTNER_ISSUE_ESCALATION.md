# Partner Issue Escalation

## Статус Stage 12E-INTERNAL-4A

Документ описывает partner-only demo UX для сообщений о проблемах и escalation. Реальных backend actions, Supabase writes, payments, Telegram/n8n и auth на этом этапе нет.

## Partner Issue Cases

Партнёр может сообщить проблему, если:

- courier is late;
- order ready but not picked up;
- item unavailable;
- kitchen/partner overloaded;
- client changed request;
- client cancelled verbally;
- wrong order details;
- payment issue;
- booking conflict;
- guest did not arrive;
- emergency stop required.

## Что партнёр может делать

- Partner can report issue.
- Partner can request admin help.
- Partner can pause future orders.
- Partner can use stop for future orders/bookings only.

## Что нельзя делать без админа

- Partner cannot cancel accepted order without admin.
- Partner cannot change payment status.
- Partner cannot force refund.
- Partner cannot enable alcohol module.
- Partner cannot treat verbal client cancellation as final status without admin rules.

## Когда подключается админ

Admin escalation required for:

- accepted order cancellation;
- confirmed booking cancellation;
- courier no-show;
- payment issue;
- refund request;
- emergency stop;
- booking conflict;
- guest did not arrive;
- high-risk AI recommendation.

## AI Dispatcher Rules

AI can:

- recommend;
- alert admin;
- draft message.

AI cannot:

- cancel order;
- approve refund;
- change payment;
- enable alcohol module.

## Alcohol Module Disabled

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales/delivery disabled.
- AI cannot enable alcohol module.
- Any future alcohol activation requires legal review, licensing, partner verification and super_admin approval.

# Partner to Courier Handoff

## Статус Stage 12E-INTERNAL-3

Документ описывает UX и операционные правила передачи заказа от партнёра курьеру. Реальный backend, Supabase writes, server actions, payments, Telegram/n8n и alcohol module не подключаются.

## Partner Responsibility Zone

Партнёр отвечает за заказ до момента передачи курьеру.

Партнёр должен:

- accept or reject order;
- prepare order;
- mark ready_for_pickup;
- keep order packed and available for courier;
- report issue if courier does not arrive.

## Exact Handoff Moment

Передача происходит после `ready_for_pickup`, когда курьер фактически забрал заказ.

Точный момент handoff:

- courier picks up the order;
- order/delivery status becomes `picked_up` or `handed_to_courier`.

После этого заказ выходит из зоны ответственности партнёра и входит в delivery responsibility zone.

## After Courier Pickup

После pickup партнёр:

- cannot cancel order;
- cannot change delivery status;
- cannot change payment status;
- can only contact admin/support;
- can report issue if courier/client/admin follow-up is needed.

## Courier Responsibility Zone

Зона ответственности курьера начинается, когда:

- courier accepts delivery;
- courier is assigned by admin/AI dispatcher.

Курьер отвечает за:

- go to partner;
- pick up order;
- confirm pickup;
- go to client;
- deliver order;
- report issue if needed.

Курьер не отвечает за:

- changing payment status;
- changing order items;
- cancelling order;
- changing partner preparation status.

## Handoff Statuses

Demo statuses:

- `new_order`
- `accepted_by_partner`
- `preparing`
- `ready_for_pickup`
- `courier_assigned`
- `courier_to_partner`
- `picked_up`
- `courier_to_client`
- `delivered`
- `issue_reported`
- `admin_required`

## Delay Cases

Delay cases that should be visible in internal UX:

- courier assigned but not moving;
- ready_for_pickup waits too long;
- partner reports courier delay;
- courier reports partner point problem;
- courier reports client problem;
- client address/contact issue.

## Admin Escalation Cases

Admin is required when:

- courier does not arrive;
- courier picked up but delivery is stuck;
- partner asks to cancel after pickup;
- client cannot receive order;
- wrong address or item missing is reported;
- payment/refund dispute appears;
- AI marks risk as high or critical.

## AI Dispatcher Limitations

AI dispatcher can:

- detect delay;
- recommend courier reassignment;
- alert admin;
- draft message to partner/courier/client.

AI dispatcher cannot:

- cancel order;
- change payment status;
- enable alcohol module;
- approve high-risk actions.

High-risk actions require human admin approval and audit log.

## Alcohol Module Disabled

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales/delivery disabled.
- AI cannot enable alcohol module.
- Any future alcohol activation requires legal review, licensing, partner verification and super_admin approval.

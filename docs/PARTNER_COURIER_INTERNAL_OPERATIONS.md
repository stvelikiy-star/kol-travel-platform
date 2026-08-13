# Partner + Courier Internal Operations

## Статус Stage 12E-INTERNAL-1

Документ фиксирует внутренние операционные зоны партнёра, курьера, delivery handoff, stop-button rules, AI dispatcher limitations и admin escalation cases. Реальный backend, Supabase writes, payments, Telegram/n8n и auth на этом этапе не подключаются.

## Partner Responsibility Zone

Партнёр отвечает за подготовку заказа и управление своей операционной доступностью:

1. New order received.
2. Partner accepts or rejects.
3. Partner marks preparing.
4. Partner marks ready_for_pickup.
5. После `ready_for_pickup` доставку контролируют courier, AI dispatcher и KOL admin.

Партнёр может:

- принять или отклонить новый заказ;
- отметить заказ как готовится;
- отметить заказ как готовый к выдаче;
- подтвердить или отклонить бронь;
- обновить каталог и доступность;
- поставить стоп на бизнес, доставку, новые заявки или отдельный item/room/tour/product.

Партнёр не может:

- менять payment status;
- закрывать курьерскую доставку;
- отменять заказ после courier pickup без админа;
- отменять уже принятые заказы или брони через stop button;
- включать alcohol sales/delivery.

## Courier Responsibility Zone

Курьер отвечает только за физическую доставку после назначения:

1. Courier sees available deliveries.
2. Courier accepts delivery.
3. Courier goes to partner.
4. Courier picks up order.
5. Courier goes to client.
6. Courier marks delivered.
7. Courier reports issue if needed.

Курьер может:

- принять назначенную или доступную доставку;
- отметить движение к партнёру;
- отметить pickup;
- отметить движение к клиенту;
- отметить delivered;
- сообщить проблему доставки.

Курьер не может:

- менять payment status;
- менять состав заказа;
- отменять заказ без админа;
- менять partner preparation status;
- включать alcohol delivery.

## Delivery Handoff

Delivery handoff происходит на статусе `ready_for_pickup`.

До handoff:

- партнёр управляет принятием, приготовлением и готовностью к выдаче;
- courier не должен закрывать подготовку партнёра.

После handoff:

- courier отвечает за физический pickup и доставку клиенту;
- AI dispatcher мониторит задержки, stuck orders и risk level;
- admin решает high-risk проблемы и спорные действия.

## Stop Button Rules

Stop button:

- blocks only new orders/bookings for selected scope;
- may pause business, delivery, new orders, item, product, room or tour;
- does not delete catalog items;
- does not cancel accepted orders;
- does not cancel accepted bookings;
- does not change payment status.

Stopping item/date blocks only new orders/bookings. Accepted orders/bookings remain active and require admin rules before cancellation.

## AI Dispatcher Limitations

AI dispatcher can:

- recommend action;
- create alert;
- suggest courier reassignment;
- draft message;
- detect stuck orders and delays.

AI dispatcher cannot:

- cancel order;
- cancel booking;
- change payment status;
- approve high-risk action;
- enable alcohol module;
- promise delivery time without data.

High-risk actions require admin approval and audit log.

## Admin Escalation Cases

Admin is required when:

- accepted order or booking cancellation is requested;
- courier picked up order and cancellation/reassignment is needed;
- payment/refund/finance issue appears;
- courier is delayed or not reachable;
- partner reports courier no-show;
- client not available or wrong address;
- AI raises high/critical risk;
- alcohol-related review or activation is requested.

## Alcohol Module Disabled

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales/delivery disabled.
- AI cannot enable alcohol module.
- Any future alcohol activation requires legal review, licensing, partner verification and super_admin approval.

# KÖL — Courier Cabinet Spec

Courier Cabinet — будущий кабинет курьера для работы с назначенными доставками. На этом этапе это только спецификация: UI, backend, auth, Supabase, payments, Telegram и n8n не создаются. `ALCOHOL_MODULE_ENABLED=false` по умолчанию.

## 1. Назначение кабинета

Кабинет курьера нужен, чтобы курьер мог:

- видеть назначенные доставки;
- принять или отклонить delivery;
- видеть pickup address партнёра;
- видеть client address;
- видеть phone/contact demo;
- обновлять delivery statuses;
- сообщать о проблемах;
- видеть earnings demo;
- управлять availability status.

## 2. Основные разделы

### Dashboard

Курьер видит:

- текущий availability status;
- активную доставку;
- количество доставок за день;
- earnings demo;
- предупреждения по задержкам.

Действия:

- выйти online/offline;
- поставить pause;
- открыть активную доставку;
- сообщить о проблеме.

### Assigned deliveries

Курьер видит:

- список назначенных доставок;
- pickup partner;
- pickup address;
- client settlement/address;
- delivery status;
- problem status, если есть.

Действия:

- accept delivery;
- reject delivery with reason;
- перейти к pickup;
- открыть детали.

### Delivery detail

Курьер видит:

- delivery ID;
- order ID;
- partner name;
- pickup address;
- client address;
- contact demo;
- список кратких позиций без лишних персональных данных;
- delivery status timeline.

Действия:

- `courier_accepted`;
- `courier_to_partner`;
- `picked_up`;
- `courier_to_client`;
- `delivered`;
- report problem.

### Problems

Курьер может сообщить:

- `partner_delay`;
- `client_not_available`;
- `wrong_address`;
- `item_missing`;
- `payment_problem`;
- `weather_delay`;
- `admin_required`.

Для каждой проблемы нужны:

- delivery ID;
- тип проблемы;
- текстовое описание;
- фото proof future;
- timestamp;
- статус обработки админом.

### Earnings demo

Курьер видит:

- deliveries completed;
- estimated earnings;
- bonuses demo;
- penalties demo;
- payout status future.

Ограничения:

- это не реальный finance ledger;
- реальные выплаты later через finance module;
- AI не меняет earnings/payment statuses.

### Profile and availability

Курьер видит:

- имя;
- телефон;
- transport type;
- availability status;
- blocked/paused reason, если есть.

Действия:

- `online`;
- `offline`;
- `paused`;
- update contact demo;
- request support.

## 3. Courier availability statuses

- `offline` — курьер не работает.
- `online` — готов принимать доставки.
- `busy` — выполняет доставку.
- `paused` — временная пауза.
- `blocked` — заблокирован админом.

## 4. Delivery status actions

| Action | From | To | Кто может |
| --- | --- | --- | --- |
| Accept delivery | `courier_assigned` | `courier_accepted` | Courier |
| Start pickup route | `courier_accepted` | `courier_to_partner` | Courier |
| Mark picked up | `courier_to_partner` | `picked_up` | Courier |
| Start client route | `picked_up` | `courier_to_client` | Courier |
| Mark delivered | `courier_to_client` | `delivered` | Courier |
| Report failed | any active delivery | `delivery_failed` + problem | Courier/Admin |

## 5. Notifications

Курьер получает:

- new assignment;
- assignment timeout warning;
- route/pickup reminder;
- admin message;
- reassignment/cancel notice;
- problem resolution notice.

Реальные Telegram/n8n notifications later; сейчас только спецификация.

## 6. Restrictions

Курьер не может:

- видеть заказы других курьеров;
- менять стоимость заказа;
- менять payment status;
- отменять заказ без admin flow;
- включать alcohol delivery;
- обещать клиенту точное ETA без данных;
- редактировать partner/client profile data.

## 7. Edge cases

- Курьер не принял delivery за 3 минуты.
- Курьер принял, но не поехал к партнёру.
- Партнёр не готов, хотя поставил `ready_for_pickup`.
- Курьер забрал неполный заказ.
- Клиент не отвечает.
- Адрес неверный.
- Плохая погода.
- Телефон клиента недоступен.
- Курьер offline после назначения.
- Админ переназначил доставку.
- Payment problem при COD/manual payment.

## 8. MVP and future

MVP:

- ручное назначение курьера;
- delivery statuses;
- problem reports;
- earnings demo;
- no live GPS;
- no real payouts.

Future:

- GPS tracking;
- map route;
- automatic assignment;
- courier rating;
- proof of delivery;
- delivery zones;
- payout automation.

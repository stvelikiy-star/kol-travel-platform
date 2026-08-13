# KÖL — Delivery System Spec

Delivery system — это операционный слой платформы KÖL, который связывает клиента, партнёра, курьера, администратора и AI Delivery Admin. На этом этапе документ описывает архитектуру и бизнес-логику без UI, backend, Supabase, auth, платежей, Telegram и n8n. `ALCOHOL_MODULE_ENABLED=false` по умолчанию.

## 1. Цель системы

Система доставки должна:

- принимать заказ после checkout;
- ждать подтверждения партнёра;
- отслеживать приготовление или сборку заказа;
- запускать поиск курьера после `ready_for_pickup`;
- назначать курьера вручную или по рекомендации AI Delivery Admin;
- отслеживать путь курьера к партнёру и клиенту;
- фиксировать доставку, проблемы и эскалации;
- передавать завершённый заказ в future loyalty flow.

## 2. Основной delivery flow

1. Client creates order.
2. Partner accepts order.
3. Partner prepares order.
4. Partner marks order as `ready_for_pickup`.
5. AI Delivery Admin checks available couriers.
6. Courier is assigned.
7. Courier accepts delivery.
8. Courier goes to partner.
9. Courier picks up order.
10. Courier goes to client.
11. Courier marks delivered.
12. Client/order is completed.
13. Loyalty points начисляются later.

## 3. Роли и ответственность

### Client

Клиент:

- видит order status;
- видит courier status;
- получает уведомления;
- может обратиться в поддержку;
- может сообщить о проблеме доставки;
- не видит внутреннюю кухню назначения курьеров.

Ограничения:

- клиент видит только свои заказы и доставки;
- клиент не может менять payment status;
- клиент не может назначать курьера.

### Partner

Партнёр:

- видит incoming orders своего бизнеса;
- принимает или отклоняет заказ;
- готовит заказ;
- ставит `ready_for_pickup`;
- видит назначенного курьера;
- может сообщить о delay/no-show курьера.

Ограничения:

- партнёр видит только свой business scope;
- партнёр не может менять delivery fee/payment status без правил платформы;
- stop-кнопка не отменяет уже принятые заказы.

### Courier

Курьер:

- видит assigned deliveries;
- принимает или отклоняет доставку;
- видит pickup address;
- видит client address;
- видит phone/contact demo;
- обновляет delivery statuses;
- сообщает о проблемах;
- видит earnings demo.

Ограничения:

- курьер не видит заказы других курьеров;
- курьер не меняет стоимость заказа;
- курьер не меняет legal/payment statuses;
- alcohol delivery запрещена до отдельного compliance approval.

### Admin

Админ:

- видит все deliveries;
- назначает и переназначает курьера;
- мониторит задержки;
- решает проблемы;
- может отменить delivery по правилам;
- может связаться с клиентом, партнёром и курьером.

Ограничения:

- все действия должны логироваться;
- отмена заказа и отмена delivery должны иметь причину;
- payment status меняется только по финансовому flow.

### AI Delivery Admin

AI Delivery Admin:

- мониторит активные orders and deliveries;
- обнаруживает stuck orders;
- проверяет time limits;
- рекомендует courier assignment;
- рекомендует escalation;
- отправляет internal alerts;
- никогда не меняет money/legal statuses без human admin approval.

Ограничения:

- не выдумывает факты;
- не обещает delivery time без данных;
- не отменяет заказ без approval;
- не включает alcohol delivery;
- не меняет payment status.

## 4. Основные сущности будущей реализации

### Delivery

Поля:

- `id`
- `order_id`
- `client_user_id`
- `business_id`
- `courier_user_id`
- `delivery_status`
- `problem_status`
- `pickup_address`
- `client_address`
- `client_phone_demo`
- `partner_phone_demo`
- `assigned_at`
- `accepted_at`
- `picked_up_at`
- `delivered_at`
- `failed_at`
- `cancelled_at`
- `created_at`
- `updated_at`

### CourierProfile

Поля:

- `id`
- `user_id`
- `name`
- `phone`
- `availability_status`
- `transport_type`
- `current_location_future`
- `rating`
- `is_blocked`
- `created_at`
- `updated_at`

### DeliveryProblem

Поля:

- `id`
- `delivery_id`
- `problem_status`
- `reported_by`
- `reported_by_role`
- `description`
- `admin_required`
- `resolved_at`
- `resolved_by`
- `created_at`
- `updated_at`

### DeliveryEventLog

Поля:

- `id`
- `delivery_id`
- `actor_id`
- `actor_role`
- `event_type`
- `from_status`
- `to_status`
- `metadata`
- `created_at`

## 5. Status model

Подробные статусы вынесены в [DELIVERY_STATUSES.md](DELIVERY_STATUSES.md).

Коротко:

- order preparation: `new`, `partner_accepted`, `partner_rejected`, `preparing`, `ready_for_pickup`;
- delivery: `delivery_pending`, `courier_searching`, `courier_assigned`, `courier_accepted`, `courier_to_partner`, `picked_up`, `courier_to_client`, `delivered`, `delivery_failed`, `cancelled`;
- problems: `partner_delay`, `courier_delay`, `client_not_available`, `wrong_address`, `item_missing`, `payment_problem`, `weather_delay`, `admin_required`;
- courier availability: `offline`, `online`, `busy`, `paused`, `blocked`.

## 6. Time rules

- Если партнёр не принял заказ за 5 минут — alert admin.
- Если партнёр готовит дольше expected time — warning.
- Если заказ `ready_for_pickup`, но курьера нет 7 минут — urgent courier search.
- Если курьер назначен, но не принял delivery за 3 минуты — reassign suggestion.
- Если курьер забрал заказ, но доставка задерживается — alert admin.
- Если клиент недоступен — admin escalation.

## 7. MVP delivery version

MVP версия:

- delivery создаётся после `ready_for_pickup`;
- курьер назначается вручную админом или по AI recommendation;
- location/GPS не обязательны;
- адреса и телефоны demo/manual;
- notifications могут быть UI-only/internal notes;
- payments остаются manual/cash/COD;
- courier earnings demo, без реального payout engine.

## 8. Future GPS/map version

Future version:

- live GPS couriers;
- map view для админа;
- ETA calculation;
- pickup/delivery radius;
- courier heatmap;
- route optimization;
- proof of delivery;
- geofence для pickup/delivery events.

## 9. Future automatic courier assignment logic

Автоназначение может учитывать:

- courier availability status;
- расстояние до партнёра;
- текущую загрузку;
- рейтинг курьера;
- transport type;
- погодные задержки;
- zone/settlement;
- историю отказов;
- максимальное число активных доставок.

AI может рекомендовать, но в MVP human admin approves assignment.

## 10. Safety and compliance notes

- Alcohol delivery OFF by default.
- AI не включает alcohol delivery и не создаёт обход compliance.
- Деньги, refunds, payment status и legal statuses не меняются AI без human approval.
- Все назначения, переназначения, задержки и отмены логируются.
- Клиентские и партнёрские персональные данные должны быть ограничены ролью.
- Поддержка и админ должны видеть только нужный минимум данных.
- Courier problem reports должны быть доступны админу и поддержке.

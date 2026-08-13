# Partner + Courier Status Actions UX

## Статус Stage 12E-INTERNAL-2

Документ описывает demo-only UX для внутренних status actions партнёра и курьера. Реальный backend, Supabase writes, server actions, payments, Telegram/n8n и alcohol module не подключаются.

## Partner Order Statuses

Партнёрский order flow:

1. Новая заявка.
2. Принять заказ.
3. Отклонить заказ.
4. В приготовлении.
5. Готов к выдаче.
6. Ожидает курьера.
7. Передано курьеру.
8. Доставка уже вне зоны партнёра.

Demo buttons:

- Принять заказ.
- Отклонить.
- Начать приготовление.
- Готов к выдаче.
- Сообщить проблему.
- Связаться с админом.

Все кнопки UI/demo only. Они не мутируют данные, не вызывают backend и не пишут в Supabase.

## Partner Booking Statuses

Партнёрский booking flow:

1. Новая бронь.
2. Подтвердить бронь.
3. Отклонить бронь.
4. Ожидает гостя.
5. Гость прибыл.
6. Завершено.
7. Изменение/отмена подтверждённой брони требует админа.

Partner responsibility notes:

- Partner controls preparation and availability.
- Partner cannot change payment status.
- Partner cannot cancel after courier pickup.
- Stop button blocks only future orders/bookings.
- Accepted orders/bookings require admin escalation for cancellation.

## Courier Delivery Statuses

Courier delivery flow:

1. Доступная доставка.
2. Принять доставку.
3. Еду к партнёру.
4. Забрал заказ.
5. Еду к клиенту.
6. Доставлено.
7. Проблема на доставке.
8. Админ подключён.

Demo buttons:

- Принять доставку.
- Еду к партнёру.
- Забрал заказ.
- Еду к клиенту.
- Доставлено.
- Сообщить проблему.
- Связаться с админом.

Все кнопки UI/demo only. Они не мутируют данные, не вызывают backend и не пишут в Supabase.

Courier responsibility notes:

- Courier controls only physical delivery.
- Courier cannot change payment status.
- Courier cannot change order items.
- Courier cannot cancel order without admin.
- Problems must be escalated to admin/AI dispatcher.

## Future Backend Actions

Будущие backend actions должны:

- validate auth, role and ownership;
- validate allowed status transition;
- write status history;
- write audit log where required;
- return safe errors;
- require admin approval for high-risk changes.

## Admin Escalation Cases

Admin escalation required for:

- accepted order/booking cancellation;
- cancellation after courier pickup;
- delivery status override;
- payment/refund dispute;
- courier reassignment after pickup;
- partner/courier blocking;
- high-risk AI recommendation.

## AI Dispatcher Notes

AI can:

- recommend next action;
- alert admin;
- suggest courier reassignment;
- draft message.

AI cannot:

- cancel order;
- change payment status;
- enable alcohol module.

High-risk actions require admin approval.

## Alcohol Module Disabled

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales/delivery disabled.
- AI cannot enable alcohol module.
- Any future alcohol activation requires legal review, licensing, partner verification and super_admin approval.

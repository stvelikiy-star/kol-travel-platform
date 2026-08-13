# API ARCHITECTURE

## Назначение

Документ описывает API architecture для KÖL / Issyk-Kul Travel & Delivery Platform. Это спецификация будущей реализации, а не backend-код.

На Stage 01C-2 не создаются сайт, UI, страницы, backend, Supabase routes, Telegram, n8n и платежные интеграции. Alcohol module не включается. `ALCOHOL_MODULE_ENABLED=false` by default.

Будущая реализация: Next.js route handlers, Supabase / PostgreSQL, Supabase RLS позже, server-side service role только на сервере.

## Auth and Role Access

Guest:
- может читать публичный каталог, поиск, карточки туров, жилья, еды и магазина;
- не может оформлять заказ, бронь, видеть личные данные или alcohol routes.

Client:
- видит только свои заказы, брони, корзину, баллы, промокоды, уведомления, платежи и обращения;
- может создавать заказы, брони, тикеты, отзывы после completed order/booking.

Partner:
- видит только свой бизнес и связанные сущности: товары, блюда, номера, туры, заказы, брони, финансы, аналитику, stop-статусы;
- не видит данные других партнёров.

Admin:
- видит всю систему;
- управляет пользователями, партнёрами, модерацией, заказами, бронями, настройками, логами.

Courier:
- видит только назначенные доставки и минимальные данные для выполнения доставки;
- обновляет только статусы назначенных доставок.

Support:
- видит ограниченные данные клиентов, партнёров, заказов и броней только в рамках тикета или операционного кейса;
- управляет обращениями и эскалациями.

Finance:
- видит платежи, возвраты, комиссии, выплаты и связанные order/booking summaries;
- не управляет контентом, ролями и модерацией.

## Success Response Format

```json
{
  "data": {},
  "meta": {
    "pagination": {},
    "filters": {},
    "status": "ok"
  },
  "request_id": "req_..."
}
```

## Error Response Format

```json
{
  "error": true,
  "code": "VALIDATION_ERROR",
  "message": "Human-readable error message",
  "details": {},
  "request_id": "req_..."
}
```

Common error codes:
- `UNAUTHORIZED`;
- `FORBIDDEN`;
- `NOT_FOUND`;
- `VALIDATION_ERROR`;
- `CONFLICT`;
- `STOP_ACTIVE`;
- `OUT_OF_STOCK`;
- `ROOM_UNAVAILABLE`;
- `TOUR_FULL`;
- `PAYMENT_REQUIRED`;
- `ALCOHOL_MODULE_DISABLED`;
- `AGE_VERIFICATION_REQUIRED`;
- `LICENSE_REQUIRED`;
- `INTERNAL_ERROR`.

## Validation Rules

Cart validation:
- проверить владельца корзины;
- сгруппировать позиции по `business_id`;
- проверить статус партнёра и `PartnerStopStatus`;
- проверить `FoodItem`, `Product`, `AlcoholProduct` availability;
- пересчитать цены, скидки, баллы и итог;
- alcohol items блокируются при `ALCOHOL_MODULE_ENABLED=false`.

Checkout validation:
- повторно проверить cart items, partner status, stop status, delivery availability, promo codes, loyalty balance, payment method;
- заказ/бронь не создаётся при блокирующей ошибке;
- результат validation логируется в `SystemLog`.

Room availability validation:
- `RoomAvailability` является источником правды;
- проверять каждую дату диапазона;
- `available_qty > 0`;
- status должен быть `available`;
- операция фиксации должна быть атомарной.

Tour schedule validation:
- `TourSchedule` является источником правды;
- status должен быть `open`;
- `booked_seats + participants <= total_seats`;
- при заполнении дата становится `full`.

Stop status validation:
- `PartnerStopStatus` является источником правды для stop-кнопки;
- `stop_business` блокирует новые заказы и брони партнёра;
- `stop_room` блокирует новые брони номера;
- `stop_tour` блокирует новые брони тура или даты;
- stop не отменяет уже принятые заказы или подтверждённые брони.

Alcohol compliance validation:
- routes gated;
- `ALCOHOL_MODULE_ENABLED=false` by default;
- при выключенном модуле все alcohol checkout действия блокируются;
- future checks: age gate 18+, `age_verified`, partner license approved, sale window, delivery age check.

## Security Rules

- Client sees only own data.
- Partner sees only own business.
- Admin sees all.
- Support and finance have limited access by task.
- No secrets in client.
- Service role only server-side.
- Alcohol routes gated and disabled while `ALCOHOL_MODULE_ENABLED=false`.
- Public APIs return only public-safe fields.
- Every sensitive mutation should produce `AdminLog` or `SystemLog`.

## 1. Auth API

Назначение: регистрация, вход, выход, текущий пользователь, роль.

Доступ: guest, client, partner, admin, courier, support, finance.

Endpoints:
- `POST /api/auth/register` — регистрация клиента или партнёра;
- `POST /api/auth/login` — вход;
- `POST /api/auth/logout` — выход;
- `GET /api/auth/me` — текущий пользователь;
- `PATCH /api/auth/me` — обновление базовых данных.

Сущности: `User`, `ClientProfile`, `PartnerProfile`, `Notification`, `AdminLog`.

Статусы: `active`, `blocked`; роли `client`, `partner`, `admin`, `courier`, `support`, `finance`.

Ошибки и edge cases:
- телефон или email уже используется;
- user blocked;
- попытка смены роли без admin;
- `age_verified` не включает alcohol module.

## 2. Public Catalog API

Назначение: публичные данные для каталога и карточек.

Доступ: guest, client, partner, admin.

Endpoints:
- `GET /api/catalog/home`;
- `GET /api/catalog/categories`;
- `GET /api/catalog/featured`;
- `GET /api/catalog/businesses`;
- `GET /api/catalog/businesses/:slug`.

Сущности: `PartnerBusiness`, `BusinessType`, `Tour`, `Stay`, `Room`, `FoodItem`, `Product`, `Review`.

Статусы: `approved`, `active`, `paused`, `hidden`, `under_review`.

Ошибки и edge cases:
- бизнес approved, но `offline`;
- контент active, но все даты/товары недоступны;
- public response не должен раскрывать внутренние поля партнёра.

## 3. Search API

Назначение: единый поиск по турам, жилью, еде, магазинам и акциям.

Доступ: guest, client.

Endpoints:
- `GET /api/search?q=&type=&location=&date=&guests=&budget=`;

Сущности: `Tour`, `TourSchedule`, `Stay`, `Room`, `RoomAvailability`, `PartnerBusiness`, `FoodItem`, `Product`, `PromoCode`.

Статусы: active catalog statuses, `available`, `open`, `online`, `paused`.

Ошибки и edge cases:
- пустой запрос;
- дата недоступна;
- stop active;
- результаты alcohol скрыты при module off.

## 4. Tours API

Назначение: публичные туры и расписания.

Доступ: guest/client read; partner/admin через отдельные scopes.

Endpoints:
- `GET /api/tours`;
- `GET /api/tours/:slug`;
- `GET /api/tours/:id/schedule`;
- `GET /api/tours/:id/reviews`.

Сущности: `Tour`, `TourSchedule`, `PartnerBusiness`, `Review`, `Booking`.

Статусы: `active`, `paused`, `archived`; schedule `open`, `full`, `closed`, `cancelled`.

Ошибки и edge cases:
- тур active, но нет open dates;
- дата стала full;
- tour stopped by `PartnerStopStatus`.

## 5. Stays / Rooms API

Назначение: публичное жильё, комнаты и доступность.

Доступ: guest/client read; partner/admin через отдельные scopes.

Endpoints:
- `GET /api/stays`;
- `GET /api/stays/:slug`;
- `GET /api/stays/:id/rooms`;
- `GET /api/rooms/:id/availability?from=&to=`.

Сущности: `Stay`, `Room`, `RoomAvailability`, `PartnerBusiness`, `Review`, `Booking`.

Статусы: `active`, `paused`, `archived`; availability `available`, `booked`, `blocked`.

Ошибки и edge cases:
- `available_qty=0`;
- date range invalid;
- room stopped or business stopped.

## 6. Food API

Назначение: рестораны/кафе, меню, блюда.

Доступ: guest/client read; partner/admin through cabinet/admin APIs.

Endpoints:
- `GET /api/food`;
- `GET /api/food/:slug`;
- `GET /api/food/:id/menu`;
- `GET /api/food/items/:id`.

Сущности: `PartnerBusiness`, `FoodCategory`, `FoodItem`, `Review`, `PartnerStopStatus`.

Статусы: `active`, `out_of_stock`, `hidden`, `stopped`, `under_review`; business `online`, `paused`, `offline`.

Ошибки и edge cases:
- item stopped после добавления в cart;
- business offline;
- menu category hidden.

## 7. Shop API

Назначение: магазины и товары.

Доступ: guest/client read; partner/admin through cabinet/admin APIs.

Endpoints:
- `GET /api/shop`;
- `GET /api/shop/:slug`;
- `GET /api/products/:id`;
- `GET /api/shop/:id/products`.

Сущности: `PartnerBusiness`, `Product`, `Review`, `PartnerStopStatus`.

Статусы: `active`, `out_of_stock`, `hidden`, `stopped`, `under_review`.

Ошибки и edge cases:
- stock changed during checkout;
- product under_review in old cart;
- shop stop_business.

## 8. Alcohol API, Gated and OFF by Default

Назначение: будущий gated API для alcohol catalog и compliance.

Доступ: disabled by default. Future access only for age-verified clients, licensed partners, admin compliance.

Endpoints:
- `GET /api/alcohol` — returns disabled error while `ALCOHOL_MODULE_ENABLED=false`;
- `GET /api/alcohol/:id`;
- `POST /api/alcohol/age-check` future;
- `POST /api/alcohol/orders` future, not active now.

Сущности: `AlcoholProduct`, `PartnerBusiness`, `User`, `Delivery`, `Order`, `AdminLog`.

Статусы: alcohol order statuses future: `new`, `accepted`, `preparing`, `delivering`, `age_check`, `completed`, `rejected`, `cancelled`, `age_check_failed`.

Ошибки и edge cases:
- `ALCOHOL_MODULE_DISABLED`;
- `AGE_VERIFICATION_REQUIRED`;
- `LICENSE_REQUIRED`;
- sale window closed;
- delivery age check failed.

## 9. Cart API

Назначение: корзина клиента и checkout preparation.

Доступ: client; guest session future.

Endpoints:
- `GET /api/cart`;
- `POST /api/cart/items`;
- `PATCH /api/cart/items/:id`;
- `DELETE /api/cart/items/:id`;
- `POST /api/cart/validate`;
- `POST /api/cart/apply-promo`;
- `POST /api/cart/apply-points`.

Сущности: `Cart`, `CartItem`, `FoodItem`, `Product`, `AlcoholProduct`, `PromoCode`, `LoyaltyAccount`, `PartnerStopStatus`.

Статусы: item statuses, promo statuses, stop statuses.

Ошибки и edge cases:
- item stopped;
- price changed;
- promo expired;
- insufficient loyalty balance;
- alcohol item blocked.

## 10. Orders API

Назначение: создание и управление заказами еды/магазина/future alcohol.

Доступ: client own orders; partner own business orders; admin/support scoped.

Endpoints:
- `POST /api/orders`;
- `GET /api/orders`;
- `GET /api/orders/:id`;
- `POST /api/orders/:id/cancel`;
- `POST /api/orders/:id/repeat`;
- `PATCH /api/partner/orders/:id/status`;
- `GET /api/admin/orders`;
- `PATCH /api/admin/orders/:id`.

Сущности: `Order`, `OrderItem`, `Cart`, `CartItem`, `Payment`, `Delivery`, `PromoCode`, `LoyaltyTransaction`, `Notification`, `SupportTicket`, `AdminLog`, `SystemLog`.

Статусы: food/shop/alcohol order statuses from `ORDER_FLOW.md`.

Ошибки и edge cases:
- checkout validation failed;
- partner rejected after payment;
- stop active;
- status transition invalid;
- partial availability in multivendor cart.

## 11. Bookings API

Назначение: создание и управление бронями жилья и туров.

Доступ: client own bookings; partner own business bookings; admin/support scoped.

Endpoints:
- `POST /api/bookings`;
- `GET /api/bookings`;
- `GET /api/bookings/:id`;
- `POST /api/bookings/:id/cancel`;
- `PATCH /api/bookings/:id/dates`;
- `PATCH /api/partner/bookings/:id/status`;
- `GET /api/admin/bookings`;
- `PATCH /api/admin/bookings/:id`.

Сущности: `Booking`, `Room`, `RoomAvailability`, `Stay`, `Tour`, `TourSchedule`, `Payment`, `PromoCode`, `LoyaltyTransaction`, `Notification`, `SupportTicket`, `PartnerStopStatus`.

Статусы: booking statuses; `available/booked/blocked`; tour schedule `open/full/closed/cancelled`.

Ошибки и edge cases:
- overbooking conflict;
- room unavailable;
- tour full;
- partner does not confirm in time;
- manual payment pending.

## 12. Client Cabinet API

Назначение: личный кабинет клиента.

Доступ: client only own data; admin/support limited.

Endpoints:
- `GET /api/client/overview`;
- `GET /api/client/orders`;
- `GET /api/client/bookings`;
- `GET /api/client/tours`;
- `GET /api/client/loyalty`;
- `GET /api/client/offers`;
- `GET /api/client/promocodes`;
- `GET /api/client/favorites`;
- `GET /api/client/profile`;
- `PATCH /api/client/profile`;
- `GET /api/client/payments`;
- `GET /api/client/support`.

Сущности: `User`, `ClientProfile`, `Order`, `Booking`, `Payment`, `LoyaltyAccount`, `LoyaltyTransaction`, `PromoCode`, `Notification`, `SupportTicket`, `Review`.

Статусы: order, booking, payment, ticket, loyalty, promo statuses.

Ошибки и edge cases:
- user tries to access another client;
- blocked user;
- stale overview counters.

## 13. Partner Cabinet API

Назначение: кабинет партнёра и управление своим бизнесом.

Доступ: partner scoped to own business; admin full.

Endpoints:
- `GET /api/partner/dashboard`;
- `GET /api/partner/businesses`;
- `GET /api/partner/orders`;
- `GET /api/partner/bookings`;
- `GET/POST/PATCH/DELETE /api/partner/menu`;
- `GET/POST/PATCH/DELETE /api/partner/products`;
- `GET/POST/PATCH /api/partner/tours`;
- `GET/POST/PATCH /api/partner/tours/:id/schedule`;
- `GET/POST/PATCH /api/partner/rooms`;
- `GET/POST/PATCH /api/partner/rooms/:id/availability`;
- `GET /api/partner/reviews`;
- `GET /api/partner/finance`;
- `GET /api/partner/analytics`;
- `PATCH /api/partner/settings`.

Сущности: `PartnerBusiness`, `FoodCategory`, `FoodItem`, `Product`, `Tour`, `TourSchedule`, `Stay`, `Room`, `RoomAvailability`, `Order`, `Booking`, `Review`, `PartnerPayout`.

Статусы: partner, business, item, order, booking, payout statuses.

Ошибки и edge cases:
- partner opens another business id;
- employee lacks permission;
- business suspended;
- content under_review.

## 14. Stop Button API

Назначение: управление доступностью бизнеса, доставки, позиций, номеров, туров и дат.

Доступ: partner own business with permission; admin; support read.

Endpoints:
- `GET /api/partner/stop`;
- `POST /api/partner/stop`;
- `DELETE /api/partner/stop/:id`;
- `GET /api/admin/stop`;
- `POST /api/admin/stop`;
- `DELETE /api/admin/stop/:id`.

Сущности: `PartnerStopStatus`, `PartnerBusiness`, `FoodItem`, `Product`, `Room`, `Tour`, `TourSchedule`, `AdminLog`, `SystemLog`.

Статусы: business `online/paused/offline`; stop types `stop_business`, `stop_delivery`, `stop_new_orders`, `stop_item`, `stop_product`, `stop_room`, `stop_tour`, `pause_30`, `pause_until_eod`, `manual_resume`.

Ошибки и edge cases:
- overlapping stops;
- stop during checkout;
- stop does not cancel accepted orders or confirmed bookings;
- manual_resume forgotten.

## 15. Admin API

Назначение: системное управление платформой.

Доступ: admin only; support/finance have separate limited APIs.

Endpoints:
- `GET/PATCH /api/admin/users`;
- `POST /api/admin/users/:id/block`;
- `GET/PATCH /api/admin/partners`;
- `POST /api/admin/partners/:id/moderate`;
- `GET /api/admin/orders`;
- `PATCH /api/admin/orders/:id`;
- `GET /api/admin/bookings`;
- `PATCH /api/admin/bookings/:id`;
- `GET/PATCH /api/admin/moderation`;
- `GET/PATCH /api/admin/settings`;
- `GET /api/admin/logs`.

Сущности: all core entities, especially `User`, `PartnerBusiness`, `Order`, `Booking`, `Review`, `AdminLog`, `SystemLog`.

Статусы: all operational statuses.

Ошибки и edge cases:
- critical action without reason;
- admin changes active booking/order;
- audit log missing;
- alcohol setting request while legal approval absent.

## 16. Payments API, Manual MVP / Online Future

Назначение: manual/cash/transfer/COD payment records now, online payments later.

Доступ: client own payments; partner summaries for own business; finance/admin full; support limited.

Endpoints:
- `POST /api/payments`;
- `GET /api/payments/:id`;
- `POST /api/payments/:id/proof`;
- `POST /api/payments/:id/refund-request`;
- `PATCH /api/finance/payments/:id/confirm`;
- `PATCH /api/finance/payments/:id/refund`.

Сущности: `Payment`, `Order`, `Booking`, `SupportTicket`, `AdminLog`, `SystemLog`.

Статусы: `pending`, `paid`, `failed`, `refunded`, `partially_refunded`, `cod`.

Ошибки и edge cases:
- payment exists after rejected order;
- refund after payout;
- proof invalid;
- online provider fields future only.

## 17. Loyalty and Promo API

Назначение: баллы, промокоды, скидки.

Доступ: client own loyalty; partner own promos if allowed; admin all; support limited.

Endpoints:
- `GET /api/loyalty`;
- `GET /api/loyalty/transactions`;
- `POST /api/loyalty/apply`;
- `GET /api/promocodes`;
- `POST /api/promocodes/validate`;
- `POST /api/partner/promos`;
- `GET /api/partner/promos`;
- `GET/POST/PATCH /api/admin/promos`.

Сущности: `LoyaltyAccount`, `LoyaltyTransaction`, `PromoCode`, `Order`, `Booking`, `PartnerBusiness`.

Статусы: loyalty `earned/spent/expired/reverted`; promo `active/used/expired/disabled`.

Ошибки и edge cases:
- insufficient points;
- promo expired during checkout;
- promo incompatible with points;
- alcohol promos disabled.

## 18. Reviews API

Назначение: отзывы после completed заказов/броней.

Доступ: public reads published; client creates own review; partner replies to own business reviews; admin moderates.

Endpoints:
- `GET /api/reviews?target=`;
- `POST /api/reviews`;
- `PATCH /api/reviews/:id`;
- `POST /api/partner/reviews/:id/reply`;
- `POST /api/partner/reviews/:id/report`;
- `PATCH /api/admin/reviews/:id/moderate`.

Сущности: `Review`, `Order`, `Booking`, `PartnerBusiness`, `User`, `AdminLog`.

Статусы: `published`, `under_review`, `hidden`.

Ошибки и edge cases:
- review before completed;
- partner tries to delete review;
- personal data in reply;
- duplicate review.

## 19. Notifications API

Назначение: in-app notifications; Telegram/n8n later.

Доступ: recipient user; admin/support limited.

Endpoints:
- `GET /api/notifications`;
- `PATCH /api/notifications/:id/read`;
- `PATCH /api/notifications/read-all`;
- `POST /api/admin/notifications`.

Сущности: `Notification`, `User`, linked `Order`, `Booking`, `SupportTicket`, `Payment`.

Статусы: `unread`, `read`.

Ошибки и edge cases:
- duplicate notification;
- external Telegram/n8n failure later logs to `SystemLog`;
- notification body must not expose secrets.

## 20. Support API

Назначение: тикеты, жалобы, возвраты, споры.

Доступ: client own tickets; partner related tickets limited; support/admin all; finance payment/refund tickets limited.

Endpoints:
- `GET /api/support/tickets`;
- `POST /api/support/tickets`;
- `GET /api/support/tickets/:id`;
- `POST /api/support/tickets/:id/messages`;
- `PATCH /api/support/tickets/:id/status`;
- `GET /api/admin/support/tickets`.

Сущности: `SupportTicket`, `User`, `Order`, `Booking`, `Payment`, `Notification`, `AdminLog`.

Статусы: `open`, `in_progress`, `resolved`, `closed`, `escalated`, `rejected`.

Ошибки и edge cases:
- duplicate ticket;
- partner sees ticket not related to own business;
- refund request without payment;
- escalation without assignee.

## 21. Analytics API

Назначение: агрегаты для партнёра, админа и future dashboards.

Доступ: partner own business analytics; admin all; finance financial analytics.

Endpoints:
- `GET /api/partner/analytics`;
- `GET /api/partner/analytics/orders`;
- `GET /api/partner/analytics/bookings`;
- `GET /api/partner/analytics/items`;
- `GET /api/admin/analytics`;
- `GET /api/admin/analytics/partners`.

Сущности: `Order`, `Booking`, `Payment`, `Review`, `Product`, `FoodItem`, `Room`, `Tour`, `PartnerBusiness`.

Статусы: completed/cancelled/rejected/refunded and related operational statuses.

Ошибки и edge cases:
- new partner has no data;
- partner requests another business;
- refunds distort revenue;
- small datasets may reveal personal data.

## 22. Finance API

Назначение: комиссии, выплаты, сверки, финансовые отчёты.

Доступ: finance/admin; partner own payout summaries.

Endpoints:
- `GET /api/finance/payments`;
- `GET /api/finance/payouts`;
- `POST /api/finance/payouts`;
- `PATCH /api/finance/payouts/:id`;
- `GET/POST/PATCH /api/finance/commissions`;
- `GET /api/partner/payouts`;
- `GET /api/partner/finance`.

Сущности: `Payment`, `PartnerPayout`, `CommissionRule`, `Order`, `Booking`, `PartnerBusiness`, `AdminLog`.

Статусы: payment statuses; payout `scheduled`, `processing`, `paid`, `failed`, `on_hold`.

Ошибки и edge cases:
- refund after payout;
- wrong payout details;
- overlapping commission rules;
- finance user attempts content moderation.

## 23. Logs API

Назначение: audit и system logs.

Доступ: admin; support/finance limited by scope.

Endpoints:
- `GET /api/admin/logs`;
- `GET /api/admin/logs/admin`;
- `GET /api/admin/logs/system`;
- `GET /api/support/logs?entity=`;

Сущности: `AdminLog`, `SystemLog`, linked operational entities.

Статусы: log severity `info`, `warning`, `error`, `critical`.

Ошибки и edge cases:
- logs contain sensitive values;
- missing audit reason;
- huge log volume;
- request_id not found.

## Future Implementation Notes

- API пока только спецификация.
- Implementation позже через Next.js route handlers.
- Supabase RLS позже.
- n8n/Telegram позже.
- Online payments позже.
- Service role only server-side.
- Alcohol routes remain gated and disabled by default until legal approval.

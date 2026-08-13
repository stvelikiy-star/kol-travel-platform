# DATABASE SCHEMA

## Назначение

Документ описывает будущую database schema для KÖL / Issyk-Kul Travel & Delivery Platform. Целевая реализация: Supabase / PostgreSQL, RLS в будущем, роли `client`, `partner`, `admin`, `courier`, `support`, `finance`.

На Stage 01C-1 создаётся только спецификация. Сайт, UI, backend, Supabase migrations, платежи, Telegram, n8n и реальные integrations не создаются и не подключаются. `ALCOHOL_MODULE_ENABLED=false`. `AlcoholProduct` существует в схеме, но alcohol module OFF by default until legal approval.

## Денежные значения

Для денежных значений используется `numeric(12,2)`.

Причина: платформа работает с заказами, бронями, комиссиями, скидками, выплатами и ручными платежами, где важна читаемость сумм в отчётах и документации. `numeric(12,2)` в PostgreSQL безопасен для денежных расчётов без ошибок floating point и понятнее для MVP-документации. Если в будущем платёжный провайдер потребует минимальные единицы, можно добавить provider-specific поля вроде `provider_amount_minor integer`.

## Общие правила таблиц

Все сущности должны иметь:
- `id uuid primary key`;
- `created_at timestamptz not null default now()`;
- `updated_at timestamptz not null default now()`.

Рекомендуемые общие поля для операционных таблиц:
- `metadata jsonb`;
- `deleted_at timestamptz`, если нужна soft delete;
- `created_by uuid`, если важен автор действия.

## 1. User

Назначение: базовая учётная запись пользователя любой роли.

Основные поля:
- `id uuid primary key`;
- `email text unique`;
- `phone text unique`;
- `password_hash text`;
- `role user_role not null`;
- `status user_status not null default 'active'`;
- `age_verified boolean not null default false`;
- `birth_date date`;
- `last_login_at timestamptz`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- 1–1 `ClientProfile`;
- 1–1 `PartnerProfile`;
- 1–N `Order`;
- 1–N `Booking`;
- 1–N `Notification`;
- 1–N `SupportTicket`.

Кто может читать:
- пользователь читает свою запись;
- admin читает все;
- support читает ограниченные контактные данные в рамках тикета;
- finance читает ограниченно для платежей/возвратов.

Кто может изменять:
- пользователь меняет свои базовые контактные данные по правилам;
- admin может менять роль и статус;
- system обновляет `last_login_at`.

Индексы:
- unique `email`;
- unique `phone`;
- `role`;
- `status`;
- `created_at`.

Ограничения:
- `role` только из enum;
- `status` только из enum;
- email или phone должны быть заданы хотя бы одним способом.

Edge cases:
- один телефон пытаются использовать несколько ролей;
- пользователь заблокирован, но имеет активные заказы/брони;
- `age_verified=true`, но alcohol module выключен.

## 2. ClientProfile

Назначение: клиентский профиль и настройки клиента.

Основные поля:
- `id uuid primary key`;
- `user_id uuid not null references User(id) unique`;
- `name text`;
- `avatar_url text`;
- `default_address_id uuid`;
- `loyalty_account_id uuid`;
- `notif_settings jsonb not null default '{}'::jsonb`;
- `locale text not null default 'ru'`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- N–1 `User`;
- 1–1 `LoyaltyAccount`;
- 1–N `Order`;
- 1–N `Booking`;
- 1–N `SupportTicket`.

Кто может читать:
- client читает только свой профиль;
- admin читает все;
- support читает ограниченно в рамках обращения.

Кто может изменять:
- client меняет свой профиль;
- admin может корректировать при поддержке.

Индексы:
- unique `user_id`;
- `loyalty_account_id`.

Ограничения:
- профиль должен ссылаться на `User.role='client'`;
- нельзя раскрывать чужие данные клиенту.

Edge cases:
- удаление default address не должно ломать историю заказов;
- смена телефона должна требовать подтверждения в будущей реализации.

## 3. PartnerProfile

Назначение: профиль владельца/оператора партнёрских бизнесов.

Основные поля:
- `id uuid primary key`;
- `user_id uuid not null references User(id) unique`;
- `display_name text`;
- `contact_phone text`;
- `payout_details jsonb`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- N–1 `User`;
- 1–N `PartnerBusiness`.

Кто может читать:
- partner читает свой профиль;
- admin читает все;
- finance читает payout data только для выплат.

Кто может изменять:
- partner меняет свой профиль и реквизиты по правилам;
- admin/finance могут корректировать реквизиты по регламенту.

Индексы:
- unique `user_id`;
- `contact_phone`.

Ограничения:
- профиль должен ссылаться на `User.role='partner'`;
- доступ к `payout_details` ограничить.

Edge cases:
- один партнёр владеет несколькими бизнесами;
- реквизиты изменены во время выплаты.

## 4. PartnerBusiness

Назначение: бизнес партнёра: отель, гостевой дом, ресторан, кафе, магазин, туроператор, гид, доставка, alcohol supplier после юр. разрешения.

Основные поля:
- `id uuid primary key`;
- `partner_profile_id uuid not null references PartnerProfile(id)`;
- `business_type_id uuid not null references BusinessType(id)`;
- `name text not null`;
- `slug text not null unique`;
- `description text`;
- `address text`;
- `geo jsonb`;
- `logo_url text`;
- `cover_url text`;
- `work_hours jsonb`;
- `delivery_zone jsonb`;
- `min_order_amount numeric(12,2)`;
- `status partner_status not null default 'pending'`;
- `stop_status business_stop_status not null default 'offline'`;
- `alcohol_enabled boolean not null default false`;
- `license_status license_status not null default 'none'`;
- `license_docs jsonb`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- N–1 `PartnerProfile`;
- N–1 `BusinessType`;
- 1–N `Tour`, `Stay`, `FoodCategory`, `FoodItem`, `Product`, `AlcoholProduct`, `Order`, `Booking`, `PartnerStopStatus`, `PartnerPayout`.

Кто может читать:
- public читает approved/public-safe поля;
- partner читает только свой бизнес;
- admin читает все;
- support/finance читают в рамках своих задач.

Кто может изменять:
- partner меняет свой бизнес в рамках прав;
- admin модерирует статус, лицензии, блокировки;
- finance меняет только финансовые служебные поля при необходимости.

Индексы:
- unique `slug`;
- `partner_profile_id`;
- `business_type_id`;
- `status`;
- `stop_status`;
- `created_at`.

Ограничения:
- alcohol flags не включают модуль глобально;
- `alcohol_enabled=true` допустим только при legal approval в будущем;
- partner не видит чужие business rows.

Edge cases:
- бизнес suspended, но есть активные обязательства;
- partner пытается сменить business type после онбординга;
- лицензия истекла при активных товарах.

## 5. BusinessType

Назначение: справочник типов бизнеса.

Основные поля:
- `id uuid primary key`;
- `code text not null unique`;
- `title text not null`;
- `enabled_modules jsonb not null default '{}'::jsonb`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- 1–N `PartnerBusiness`.

Кто может читать:
- все роли могут читать справочник.

Кто может изменять:
- admin.

Индексы:
- unique `code`.

Ограничения:
- допустимые коды: `hotel`, `guesthouse`, `restaurant`, `cafe`, `shop`, `tour_operator`, `guide`, `delivery_service`, `alcohol_supplier`.

Edge cases:
- модуль выключен глобально, но включён в `enabled_modules`.

## 6. Tour

Назначение: тур или активность, которую продаёт туроператор/гид.

Основные поля:
- `id uuid primary key`;
- `business_id uuid not null references PartnerBusiness(id)`;
- `title text not null`;
- `slug text not null unique`;
- `description text`;
- `route jsonb`;
- `duration_minutes integer`;
- `price numeric(12,2) not null`;
- `includes jsonb`;
- `excludes jsonb`;
- `min_group integer`;
- `max_group integer`;
- `cancel_policy jsonb`;
- `status catalog_status not null default 'under_review'`;
- `rating_avg numeric(3,2)`;
- `photos jsonb`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- N–1 `PartnerBusiness`;
- 1–N `TourSchedule`;
- 1–N `Booking`;
- 1–N `Review`.

Кто может читать:
- public читает active tours;
- partner читает свои tours;
- admin читает все.

Кто может изменять:
- partner меняет свои tours;
- admin модерирует.

Индексы:
- unique `slug`;
- `business_id`;
- `status`;
- `created_at`.

Ограничения:
- `price >= 0`;
- `max_group >= min_group`;
- архивный тур не бронируется.

Edge cases:
- тур active, но все даты `closed` или `full`;
- гид имеет доступ только к назначенным турам.

## 7. TourSchedule

Назначение: источник правды по датам, времени и местам тура.

Основные поля:
- `id uuid primary key`;
- `tour_id uuid not null references Tour(id)`;
- `date date not null`;
- `time time`;
- `total_seats integer not null`;
- `booked_seats integer not null default 0`;
- `price_override numeric(12,2)`;
- `status tour_schedule_status not null default 'open'`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- N–1 `Tour`;
- 1–N `Booking`.

Кто может читать:
- public читает open schedules для active tours;
- partner читает schedules своих tours;
- admin читает все.

Кто может изменять:
- partner меняет свои schedules;
- admin может модерировать/корректировать.

Индексы:
- `tour_id`;
- `date`;
- composite `tour_id, date`;
- `status`.

Ограничения:
- `booked_seats <= total_seats`;
- `booked_seats >= 0`;
- `total_seats >= 0`;
- если `booked_seats = total_seats`, статус должен стать `full` по бизнес-логике.

Edge cases:
- два клиента одновременно бронируют последние места;
- дата cancelled при confirmed bookings.

## 8. Stay

Назначение: объект размещения: отель, гостевой дом, коттедж.

Основные поля:
- `id uuid primary key`;
- `business_id uuid not null references PartnerBusiness(id)`;
- `title text not null`;
- `slug text not null unique`;
- `type text not null`;
- `description text`;
- `address text`;
- `geo jsonb`;
- `amenities jsonb`;
- `rules jsonb`;
- `rating_avg numeric(3,2)`;
- `photos jsonb`;
- `status catalog_status not null default 'under_review'`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- N–1 `PartnerBusiness`;
- 1–N `Room`;
- 1–N `Review`.

Кто может читать:
- public читает active stays;
- partner читает свои stays;
- admin читает все.

Кто может изменять:
- partner меняет свои stays;
- admin модерирует.

Индексы:
- unique `slug`;
- `business_id`;
- `status`.

Ограничения:
- Stay должен принадлежать бизнесу типа hotel/guesthouse.

Edge cases:
- объект активен, но все номера заблокированы;
- адрес изменён при активных бронях.

## 9. Room

Назначение: номер или тип номера в объекте размещения.

Основные поля:
- `id uuid primary key`;
- `stay_id uuid not null references Stay(id)`;
- `business_id uuid not null references PartnerBusiness(id)`;
- `name text not null`;
- `room_type text`;
- `capacity integer not null`;
- `price_per_night numeric(12,2) not null`;
- `qty integer not null default 1`;
- `amenities jsonb`;
- `photos jsonb`;
- `rules jsonb`;
- `status room_status not null default 'active'`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- N–1 `Stay`;
- N–1 `PartnerBusiness`;
- 1–N `RoomAvailability`;
- 1–N `Booking`.

Кто может читать:
- public читает active rooms для active stays;
- partner читает свои rooms;
- admin читает все.

Кто может изменять:
- partner меняет свои rooms;
- admin.

Индексы:
- `stay_id`;
- `business_id`;
- `status`.

Ограничения:
- `capacity > 0`;
- `qty >= 0`;
- нельзя удалить room с активными bookings.

Edge cases:
- qty уменьшили ниже уже забронированного количества;
- room paused, но есть confirmed bookings.

## 10. RoomAvailability

Назначение: источник правды для доступности номеров и защиты от overbooking.

Основные поля:
- `id uuid primary key`;
- `room_id uuid not null references Room(id)`;
- `date date not null`;
- `available_qty integer not null`;
- `price_override numeric(12,2)`;
- `status availability_status not null default 'available'`;
- `booking_id uuid references Booking(id)`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- N–1 `Room`;
- optional N–1 `Booking`.

Кто может читать:
- public читает агрегированную доступность;
- partner читает availability своих rooms;
- admin читает все.

Кто может изменять:
- partner меняет свои dates;
- system меняет при booking/cancel;
- admin может корректировать.

Индексы:
- unique `room_id, date`;
- `room_id`;
- `date`;
- `status`;
- `booking_id`.

Ограничения:
- `available_qty >= 0`;
- `status in ('available','booked','blocked')`;
- booking checkout должен атомарно уменьшать `available_qty`.

Edge cases:
- два клиента бронируют последний room одновременно;
- дата `available`, но `available_qty=0`;
- ручная блокировка пересекается с confirmed booking.

## 11. FoodCategory

Назначение: категории меню ресторана/кафе.

Основные поля:
- `id uuid primary key`;
- `business_id uuid not null references PartnerBusiness(id)`;
- `title text not null`;
- `sort_order integer not null default 0`;
- `is_active boolean not null default true`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- N–1 `PartnerBusiness`;
- 1–N `FoodItem`.

Кто может читать:
- public читает active categories для approved businesses;
- partner читает свои categories;
- admin читает все.

Кто может изменять:
- partner для своего бизнеса;
- admin.

Индексы:
- `business_id`;
- `sort_order`.

Ограничения:
- категория должна принадлежать restaurant/cafe business.

Edge cases:
- категория скрыта, но блюда active;
- сортировка конфликтует после массового импорта.

## 12. FoodItem

Назначение: блюдо или позиция меню.

Основные поля:
- `id uuid primary key`;
- `business_id uuid not null references PartnerBusiness(id)`;
- `category_id uuid references FoodCategory(id)`;
- `title text not null`;
- `description text`;
- `price numeric(12,2) not null`;
- `photo_url text`;
- `options jsonb`;
- `prep_time_minutes integer`;
- `tags jsonb`;
- `status item_status not null default 'under_review'`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- N–1 `PartnerBusiness`;
- N–1 `FoodCategory`;
- referenced by `CartItem` / `OrderItem` via polymorphic item fields.

Кто может читать:
- public читает active items;
- partner читает своё меню;
- admin читает все.

Кто может изменять:
- partner меняет своё меню;
- admin модерирует.

Индексы:
- `business_id`;
- `category_id`;
- `status`.

Ограничения:
- `price >= 0`;
- active item должен быть у approved business;
- статусы: `active`, `out_of_stock`, `hidden`, `stopped`, `under_review`.

Edge cases:
- блюдо в корзине стало `stopped`;
- цена изменилась между cart и checkout.

## 13. Product

Назначение: товар магазина.

Основные поля:
- `id uuid primary key`;
- `business_id uuid not null references PartnerBusiness(id)`;
- `category text`;
- `title text not null`;
- `description text`;
- `price numeric(12,2) not null`;
- `stock_qty integer not null default 0`;
- `photos jsonb`;
- `status item_status not null default 'under_review'`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- N–1 `PartnerBusiness`;
- referenced by `CartItem` / `OrderItem`.

Кто может читать:
- public читает active products;
- partner читает свои products;
- admin читает все.

Кто может изменять:
- partner меняет свои products;
- admin модерирует.

Индексы:
- `business_id`;
- `category`;
- `status`.

Ограничения:
- `price >= 0`;
- `stock_qty >= 0`;
- при `stock_qty=0` checkout считает товар недоступным.

Edge cases:
- остаток изменился во время checkout;
- товар under_review участвует в старой корзине.

## 14. AlcoholProduct

Назначение: алкогольный товар как будущий compliance-модуль.

Основные поля:
- `id uuid primary key`;
- `business_id uuid not null references PartnerBusiness(id)`;
- `title text not null`;
- `type text`;
- `abv numeric(5,2)`;
- `volume_ml integer`;
- `price numeric(12,2) not null`;
- `stock_qty integer not null default 0`;
- `photos jsonb`;
- `status item_status not null default 'under_review'`;
- `min_age integer not null default 18`;
- `license_ref text`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- N–1 `PartnerBusiness`;
- referenced by future `CartItem` / `OrderItem`.

Кто может читать:
- admin читает все;
- partner читает свои alcohol products;
- public/client не видят alcohol products пока `ALCOHOL_MODULE_ENABLED=false`.

Кто может изменять:
- partner может готовить данные только после юр. разрешения;
- admin модерирует лицензии и видимость.

Индексы:
- `business_id`;
- `status`;
- `license_ref`.

Ограничения:
- alcohol module OFF by default until legal approval;
- доступен только при global flag, approved license, age gate и окне продаж в будущей реализации.

Edge cases:
- alcohol product существует в БД, но модуль выключен;
- лицензия партнёра revoked, товары должны стать недоступными.

## 15. Cart

Назначение: корзина клиента до создания заказов/броней.

Основные поля:
- `id uuid primary key`;
- `user_id uuid references User(id)`;
- `session_id text`;
- `currency text not null default 'KGS'`;
- `subtotal_amount numeric(12,2) not null default 0`;
- `discount_amount numeric(12,2) not null default 0`;
- `loyalty_spent_amount numeric(12,2) not null default 0`;
- `total_amount numeric(12,2) not null default 0`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- N–1 `User`;
- 1–N `CartItem`.

Кто может читать:
- client читает свою cart;
- guest через session в будущем;
- admin/support не читают без причины.

Кто может изменять:
- client/session owner;
- system при checkout validation.

Индексы:
- `user_id`;
- `session_id`;
- `updated_at`.

Ограничения:
- cart может быть user-based или session-based;
- checkout обязан перепроверять цены и доступность.

Edge cases:
- guest cart merge после login;
- item stopped после добавления.

## 16. CartItem

Назначение: позиция корзины.

Основные поля:
- `id uuid primary key`;
- `cart_id uuid not null references Cart(id)`;
- `business_id uuid not null references PartnerBusiness(id)`;
- `item_type text not null`;
- `item_id uuid not null`;
- `qty integer not null default 1`;
- `options jsonb`;
- `price_snapshot numeric(12,2)`;
- `availability_status text`;
- `validation_error text`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- N–1 `Cart`;
- N–1 `PartnerBusiness`;
- polymorphic reference to `FoodItem`, `Product`, `AlcoholProduct`, future booking item.

Кто может читать:
- cart owner;
- admin for debugging only.

Кто может изменять:
- cart owner;
- system при validation.

Индексы:
- `cart_id`;
- `business_id`;
- `item_type, item_id`.

Ограничения:
- `qty > 0`;
- alcohol item blocked while module off.

Edge cases:
- мультивендорная корзина частично доступна;
- промокод зависит от удалённой позиции.

## 17. Order

Назначение: заказ еды, магазина или будущего alcohol module.

Основные поля:
- `id uuid primary key`;
- `user_id uuid not null references User(id)`;
- `business_id uuid not null references PartnerBusiness(id)`;
- `type order_type not null`;
- `status order_status not null default 'new'`;
- `subtotal_amount numeric(12,2) not null`;
- `delivery_fee numeric(12,2) not null default 0`;
- `discount_amount numeric(12,2) not null default 0`;
- `points_spent_amount numeric(12,2) not null default 0`;
- `total_amount numeric(12,2) not null`;
- `payment_id uuid`;
- `delivery_id uuid`;
- `address_snapshot jsonb`;
- `note text`;
- `placed_at timestamptz`;
- `accepted_at timestamptz`;
- `completed_at timestamptz`;
- `cancelled_at timestamptz`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- N–1 `User`;
- N–1 `PartnerBusiness`;
- 1–N `OrderItem`;
- 1–1 `Payment`;
- 1–1 `Delivery`;
- 1–N `Review`.

Кто может читать:
- client читает свои orders;
- partner читает orders своего business;
- admin все;
- support limited для тикетов;
- finance limited для payment/refund.

Кто может изменять:
- partner меняет статусы своих orders;
- client может cancel по правилам;
- support/admin по регламенту;
- system при checkout.

Индексы:
- `user_id`;
- `business_id`;
- `status`;
- `created_at`;
- `placed_at`.

Ограничения:
- partner cannot access other business orders;
- status transitions только по order flow;
- alcohol orders disabled while module off.

Edge cases:
- partner stop_business при active orders;
- payment exists but order rejected.

## 18. OrderItem

Назначение: позиция заказа с snapshot данных на момент оформления.

Основные поля:
- `id uuid primary key`;
- `order_id uuid not null references Order(id)`;
- `item_type text not null`;
- `item_id uuid not null`;
- `title_snapshot text not null`;
- `qty integer not null`;
- `unit_price numeric(12,2) not null`;
- `options_snapshot jsonb`;
- `status text`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- N–1 `Order`;
- polymorphic reference to item source.

Кто может читать:
- client owner через order;
- partner business owner через order;
- admin/support/finance по scope.

Кто может изменять:
- system creates snapshot;
- admin/support only for corrections by policy.

Индексы:
- `order_id`;
- `item_type, item_id`.

Ограничения:
- `qty > 0`;
- snapshots immutable после создания, кроме служебных корректировок.

Edge cases:
- source item deleted after order;
- partial refund per item in future.

## 19. Booking

Назначение: бронь жилья или тура.

Основные поля:
- `id uuid primary key`;
- `user_id uuid not null references User(id)`;
- `business_id uuid not null references PartnerBusiness(id)`;
- `type booking_type not null`;
- `object_id uuid not null`;
- `schedule_id uuid`;
- `date_from date`;
- `date_to date`;
- `guests integer`;
- `participants integer`;
- `amount numeric(12,2) not null`;
- `prepaid numeric(12,2) not null default 0`;
- `status booking_status not null default 'pending'`;
- `cancel_policy jsonb`;
- `payment_id uuid`;
- `promo_code_id uuid references PromoCode(id)`;
- `loyalty_spent_amount numeric(12,2) not null default 0`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- N–1 `User`;
- N–1 `PartnerBusiness`;
- N–1 `Room` or `Tour` by `object_id`;
- N–1 `TourSchedule` by `schedule_id`;
- 1–1 `Payment`;
- 1–N `Review`.

Кто может читать:
- client reads own bookings;
- partner reads bookings of own business;
- admin all;
- support limited;
- finance limited.

Кто может изменять:
- partner confirms/rejects own bookings;
- client cancels by rules;
- admin/support by policy;
- system updates availability atomically.

Индексы:
- `user_id`;
- `business_id`;
- `object_id`;
- `schedule_id`;
- `status`;
- `created_at`;

Ограничения:
- no overbooking;
- stay booking must use `RoomAvailability`;
- tour booking must use `TourSchedule`;
- status transitions only by booking flow.

Edge cases:
- date change must reserve new dates before releasing old;
- confirmed booking cancelled by partner requires reason.

## 20. Payment

Назначение: оплата заказа или брони. MVP: `manual`, `cash`, `transfer`, `cod`. Online payments later.

Основные поля:
- `id uuid primary key`;
- `user_id uuid not null references User(id)`;
- `order_id uuid references Order(id)`;
- `booking_id uuid references Booking(id)`;
- `method payment_method not null`;
- `amount numeric(12,2) not null`;
- `status payment_status not null default 'pending'`;
- `provider_ref text`;
- `proof_url text`;
- `paid_at timestamptz`;
- `refunded_amount numeric(12,2) not null default 0`;
- `confirmed_by uuid references User(id)`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- N–1 `User`;
- optional N–1 `Order`;
- optional N–1 `Booking`.

Кто может читать:
- client reads own payments;
- partner reads payment summary for own business orders/bookings;
- finance/admin reads all;
- support limited.

Кто может изменять:
- finance/admin confirm/refund;
- system marks pending;
- partner cannot alter payment status directly unless future policy allows.

Индексы:
- `user_id`;
- `order_id`;
- `booking_id`;
- `status`;
- `created_at`.

Ограничения:
- exactly one of `order_id` or `booking_id` should be set;
- `amount >= 0`;
- online provider fields optional for future.

Edge cases:
- order rejected after manual payment;
- refund after partner payout.

## 21. Delivery

Назначение: доставка заказа.

Основные поля:
- `id uuid primary key`;
- `order_id uuid not null references Order(id)`;
- `courier_id uuid references User(id)`;
- `status delivery_status not null default 'unassigned'`;
- `address jsonb`;
- `eta timestamptz`;
- `age_check_passed boolean`;
- `proof jsonb`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- 1–1 `Order`;
- N–1 `User` courier.

Кто может читать:
- client reads own delivery;
- partner reads delivery for own order;
- courier reads assigned deliveries;
- admin/support all by need.

Кто может изменять:
- partner/courier update operational statuses;
- admin/support by policy.

Индексы:
- `order_id`;
- `courier_id`;
- `status`;
- `created_at`.

Ограничения:
- delivery belongs to one order;
- alcohol `age_check_passed` unused while module off.

Edge cases:
- delivery stopped but order ready;
- courier user blocked mid-delivery.

## 22. PromoCode

Назначение: промокоды и скидки.

Основные поля:
- `id uuid primary key`;
- `code text not null unique`;
- `scope promo_scope not null`;
- `business_id uuid references PartnerBusiness(id)`;
- `discount_type discount_type not null`;
- `value numeric(12,2) not null`;
- `min_order numeric(12,2)`;
- `usage_limit integer`;
- `used_count integer not null default 0`;
- `valid_from timestamptz`;
- `valid_to timestamptz`;
- `status promo_status not null default 'active'`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- optional N–1 `PartnerBusiness`;
- referenced by `Order`, `Booking`.

Кто может читать:
- client sees public/applicable codes and own personal codes if added later;
- partner sees own business codes;
- admin all.

Кто может изменять:
- admin;
- partner for own promos if allowed.

Индексы:
- unique `code`;
- `business_id`;
- `status`;
- `valid_from, valid_to`.

Ограничения:
- `used_count <= usage_limit` when limit set;
- alcohol promos disabled while module off.

Edge cases:
- promo expires during checkout;
- promo incompatible with points.

## 23. LoyaltyAccount

Назначение: баланс баллов клиента.

Основные поля:
- `id uuid primary key`;
- `user_id uuid not null references User(id) unique`;
- `balance integer not null default 0`;
- `lifetime_earned integer not null default 0`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- 1–1 `User`;
- 1–N `LoyaltyTransaction`.

Кто может читать:
- client reads own account;
- admin/support limited for disputes.

Кто может изменять:
- system through transactions;
- admin/support by correction policy.

Индексы:
- unique `user_id`.

Ограничения:
- `balance >= 0`;
- balance changes should be derived from transactions.

Edge cases:
- refund after points earned;
- insufficient points at checkout.

## 24. LoyaltyTransaction

Назначение: история начисления, списания, истечения и отката баллов.

Основные поля:
- `id uuid primary key`;
- `account_id uuid not null references LoyaltyAccount(id)`;
- `order_id uuid references Order(id)`;
- `booking_id uuid references Booking(id)`;
- `type loyalty_transaction_type not null`;
- `points integer not null`;
- `amount_equivalent numeric(12,2)`;
- `note text`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- N–1 `LoyaltyAccount`;
- optional N–1 `Order`;
- optional N–1 `Booking`.

Кто может читать:
- client reads own transactions;
- admin/support limited.

Кто может изменять:
- system creates;
- admin/support corrections only via new transaction, not editing history.

Индексы:
- `account_id`;
- `order_id`;
- `booking_id`;
- `type`;
- `created_at`.

Ограничения:
- points cannot be 0;
- immutable after creation except metadata corrections.

Edge cases:
- duplicate earning on completed order;
- revert after partial refund.

## 25. Review

Назначение: отзывы клиентов после completed заказа или брони.

Основные поля:
- `id uuid primary key`;
- `user_id uuid not null references User(id)`;
- `business_id uuid not null references PartnerBusiness(id)`;
- `target_type text not null`;
- `target_id uuid`;
- `order_id uuid references Order(id)`;
- `booking_id uuid references Booking(id)`;
- `rating integer not null`;
- `text text`;
- `photos jsonb`;
- `status review_status not null default 'under_review'`;
- `partner_reply text`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- N–1 `User`;
- N–1 `PartnerBusiness`;
- optional N–1 `Order`;
- optional N–1 `Booking`.

Кто может читать:
- public reads published;
- client reads own;
- partner reads reviews for own business;
- admin all.

Кто может изменять:
- client creates/edits within rules;
- partner can reply;
- admin moderates.

Индексы:
- `business_id`;
- `user_id`;
- `order_id`;
- `booking_id`;
- `status`;
- `created_at`.

Ограничения:
- `rating between 1 and 5`;
- review only after completed order/booking.

Edge cases:
- review for cancelled order;
- partner reply leaks personal data.

## 26. Notification

Назначение: in-app уведомления и будущие каналы.

Основные поля:
- `id uuid primary key`;
- `user_id uuid not null references User(id)`;
- `type text not null`;
- `title text`;
- `body text`;
- `channel notification_channel not null default 'in_app'`;
- `payload jsonb`;
- `is_read boolean not null default false`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- N–1 `User`.

Кто может читать:
- recipient user only;
- admin/support limited for troubleshooting.

Кто может изменять:
- user marks read;
- system creates;
- admin may create system notifications.

Индексы:
- `user_id`;
- `is_read`;
- `created_at`;
- `type`.

Ограничения:
- Telegram/n8n not active at this stage;
- sensitive data should not be stored in notification body.

Edge cases:
- external notification failure should not change business status;
- duplicate notifications.

## 27. SupportTicket

Назначение: обращения, жалобы, возвраты, споры.

Основные поля:
- `id uuid primary key`;
- `user_id uuid not null references User(id)`;
- `business_id uuid references PartnerBusiness(id)`;
- `order_id uuid references Order(id)`;
- `booking_id uuid references Booking(id)`;
- `category text not null`;
- `subject text`;
- `messages jsonb not null default '[]'::jsonb`;
- `status ticket_status not null default 'open'`;
- `priority text`;
- `assignee_id uuid references User(id)`;
- `resolution text`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- N–1 `User`;
- optional N–1 `PartnerBusiness`;
- optional N–1 `Order`;
- optional N–1 `Booking`;
- optional assignee `User`.

Кто может читать:
- client reads own tickets;
- partner reads tickets related to own business with limited customer data;
- support/admin all;
- finance reads payment/refund related tickets.

Кто может изменять:
- client adds messages to own ticket;
- support/admin manage status;
- partner can respond in allowed tickets.

Индексы:
- `user_id`;
- `business_id`;
- `order_id`;
- `booking_id`;
- `status`;
- `assignee_id`;
- `created_at`.

Ограничения:
- partner cannot see tickets unrelated to own business;
- messages may need separate table in future for scale.

Edge cases:
- multiple tickets for same order;
- ticket references both order and booking incorrectly.

## 28. PartnerStopStatus

Назначение: источник правды для stop-кнопки.

Основные поля:
- `id uuid primary key`;
- `business_id uuid not null references PartnerBusiness(id)`;
- `scope stop_scope not null`;
- `target_id uuid`;
- `type stop_type not null`;
- `reason text`;
- `started_at timestamptz not null default now()`;
- `resume_at timestamptz`;
- `is_active boolean not null default true`;
- `created_by uuid references User(id)`;
- `created_by_role user_role`;
- `auto_resume boolean not null default false`;
- `resolved_at timestamptz`;
- `resolved_by uuid references User(id)`;
- `metadata jsonb`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- N–1 `PartnerBusiness`;
- references `User` as actor.

Кто может читать:
- partner reads own business stops;
- admin/support reads all;
- client sees only derived availability, not raw stop records.

Кто может изменять:
- partner staff with permission;
- admin;
- system for auto resume.

Индексы:
- `business_id`;
- `is_active`;
- `scope`;
- `target_id`;
- `created_at`.

Ограничения:
- stop does not cancel accepted orders or confirmed bookings;
- active stops must be considered in checkout.

Edge cases:
- overlapping stops;
- manual_resume left active for days.

## 29. CommissionRule

Назначение: правила комиссии платформы.

Основные поля:
- `id uuid primary key`;
- `business_type_id uuid references BusinessType(id)`;
- `business_id uuid references PartnerBusiness(id)`;
- `order_type text not null`;
- `commission_type commission_type not null`;
- `value numeric(12,2) not null`;
- `active boolean not null default true`;
- `valid_from timestamptz`;
- `valid_to timestamptz`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- optional N–1 `BusinessType`;
- optional N–1 `PartnerBusiness`.

Кто может читать:
- admin/finance all;
- partner may read applied commission summary, not all rules.

Кто может изменять:
- admin/finance.

Индексы:
- `business_type_id`;
- `business_id`;
- `order_type`;
- `active`;
- `valid_from, valid_to`.

Ограничения:
- rule can be global, by business type, or by business;
- overlapping rules need priority policy.

Edge cases:
- commission changed mid-period;
- refund after commission calculated.

## 30. PartnerPayout

Назначение: выплаты партнёрам.

Основные поля:
- `id uuid primary key`;
- `business_id uuid not null references PartnerBusiness(id)`;
- `period_from date not null`;
- `period_to date not null`;
- `gross_amount numeric(12,2) not null`;
- `commission_amount numeric(12,2) not null`;
- `adjustments_amount numeric(12,2) not null default 0`;
- `net_amount numeric(12,2) not null`;
- `status payout_status not null default 'scheduled'`;
- `paid_at timestamptz`;
- `processed_by uuid references User(id)`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- N–1 `PartnerBusiness`;
- optional N–1 finance/admin `User`.

Кто может читать:
- partner reads own payouts;
- finance/admin all.

Кто может изменять:
- finance/admin;
- partner cannot change payout status.

Индексы:
- `business_id`;
- `status`;
- `period_from, period_to`;
- `created_at`.

Ограничения:
- `period_to >= period_from`;
- payout should exclude unresolved disputes if policy requires.

Edge cases:
- refund after payout;
- wrong payout details.

## 31. AdminLog

Назначение: аудит действий админа, поддержки, финансов и критических операций.

Основные поля:
- `id uuid primary key`;
- `actor_id uuid references User(id)`;
- `action text not null`;
- `entity_type text not null`;
- `entity_id uuid`;
- `diff jsonb`;
- `ip inet`;
- `reason text`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- N–1 `User` actor.

Кто может читать:
- admin;
- limited audit roles in future.

Кто может изменять:
- system creates append-only;
- no user edits.

Индексы:
- `actor_id`;
- `entity_type, entity_id`;
- `action`;
- `created_at`.

Ограничения:
- append-only by policy;
- sensitive values should be masked.

Edge cases:
- admin changes critical status without reason;
- log volume grows quickly.

## 32. SystemLog

Назначение: технические и системные события: checkout errors, notification failures, availability conflicts.

Основные поля:
- `id uuid primary key`;
- `event_type text not null`;
- `entity_type text`;
- `entity_id uuid`;
- `severity log_severity not null default 'info'`;
- `message text`;
- `metadata jsonb`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Связи:
- optional polymorphic entity reference.

Кто может читать:
- admin;
- support for relevant events;
- finance for payment/refund events if needed.

Кто может изменять:
- system creates;
- admin may annotate in future, not edit original event.

Индексы:
- `event_type`;
- `entity_type, entity_id`;
- `severity`;
- `created_at`.

Ограничения:
- do not store secrets or raw tokens;
- external integration errors do not change business status by themselves.

Edge cases:
- Telegram/n8n failure while integrations are disabled;
- repeated checkout validation errors.

## Основные enum/status значения

User role:
- `client`;
- `partner`;
- `admin`;
- `courier`;
- `support`;
- `finance`.

User status:
- `active`;
- `blocked`.

Partner status:
- `pending`;
- `approved`;
- `suspended`;
- `rejected`;
- `archived`.

Order type:
- `food`;
- `shop`;
- `alcohol`.

Order status:
- food: `new`, `accepted`, `preparing`, `ready`, `delivering`, `completed`, `rejected`, `cancelled`;
- shop: `new`, `accepted`, `assembling`, `ready`, `delivering`, `completed`, `rejected`, `cancelled`;
- alcohol: `new`, `accepted`, `preparing`, `delivering`, `age_check`, `completed`, `rejected`, `cancelled`, `age_check_failed`.

Booking status:
- stay: `pending`, `confirmed`, `checked_in`, `completed`, `cancelled`, `rejected`, `no_show`;
- tour: `pending`, `confirmed`, `completed`, `cancelled`, `rejected`, `no_show`.

Payment method:
- `manual`;
- `cash`;
- `transfer`;
- `cod`;
- `online_future`.

Payment status:
- `pending`;
- `paid`;
- `failed`;
- `refunded`;
- `partially_refunded`;
- `cod`.

Delivery status:
- `unassigned`;
- `assigned`;
- `picked_up`;
- `in_transit`;
- `delivered`;
- `failed`;
- `returned`.

Product/item status:
- `active`;
- `out_of_stock`;
- `hidden`;
- `stopped`;
- `under_review`.

Catalog status:
- `active`;
- `paused`;
- `archived`;
- `under_review`;
- `hidden`.

Availability status:
- `available`;
- `booked`;
- `blocked`.

Tour schedule status:
- `open`;
- `full`;
- `closed`;
- `cancelled`.

Stop status / business stop status:
- `online`;
- `paused`;
- `offline`.

Stop scope:
- `business`;
- `delivery`;
- `new_orders`;
- `item`;
- `product`;
- `room`;
- `tour`;
- `tour_schedule`.

Stop type:
- `stop_business`;
- `stop_delivery`;
- `stop_new_orders`;
- `stop_item`;
- `stop_product`;
- `stop_room`;
- `stop_tour`;
- `pause_30`;
- `pause_until_eod`;
- `manual_resume`.

Payout status:
- `scheduled`;
- `processing`;
- `paid`;
- `failed`;
- `on_hold`.

Ticket status:
- `open`;
- `in_progress`;
- `resolved`;
- `closed`;
- `escalated`;
- `rejected`.

Review status:
- `published`;
- `under_review`;
- `hidden`.

Promo status:
- `active`;
- `used`;
- `expired`;
- `disabled`.

Loyalty transaction type:
- `earned`;
- `spent`;
- `expired`;
- `reverted`.

## RLS strategy future

Client scope:
- client can read/update own `User`, `ClientProfile`, `Cart`, `CartItem`;
- client can read own `Order`, `OrderItem`, `Booking`, `Payment`, `Delivery`, `LoyaltyAccount`, `LoyaltyTransaction`, `Notification`, `SupportTicket`;
- client cannot read other clients' data or partner internal fields.

Partner scope:
- partner can read/update `PartnerBusiness` rows owned through `PartnerProfile`;
- partner can read/update own `FoodCategory`, `FoodItem`, `Product`, `Tour`, `TourSchedule`, `Stay`, `Room`, `RoomAvailability`, `PartnerStopStatus`;
- partner can read own `Order`, `OrderItem`, `Booking`, `Review`, `Notification`, `PartnerPayout` summaries;
- partner cannot read other partners' businesses, orders, bookings, finance or analytics.

Admin full access:
- admin can read and manage all rows according to internal admin permissions;
- critical actions must create `AdminLog`.

Support limited access:
- support can read users/orders/bookings/payments only when connected to a ticket or operational case;
- support can update `SupportTicket` and limited order/booking statuses by policy;
- support cannot change commission rules or payouts.

Finance limited access:
- finance can read payments, payouts, commission rules, partner payout details and related order/booking summaries;
- finance can update `Payment`, `PartnerPayout`, refund-related fields and finance logs;
- finance cannot moderate catalog content or change user roles.

Courier scope:
- courier can read assigned `Delivery` rows and minimal related order/customer delivery data;
- courier can update delivery statuses only for assigned deliveries.

Alcohol module:
- alcohol rows are hidden from public/client flows while `ALCOHOL_MODULE_ENABLED=false`;
- future RLS must also check global flag, partner license, age verification and sale window.

## Индексы

Самые важные индексы:
- `user_id` on `Order`, `Booking`, `Payment`, `Cart`, `LoyaltyAccount`, `Notification`, `SupportTicket`, `Review`;
- `business_id` on `PartnerBusiness` children: `Tour`, `Stay`, `Room`, `FoodCategory`, `FoodItem`, `Product`, `AlcoholProduct`, `Order`, `Booking`, `PartnerStopStatus`, `PartnerPayout`, `SupportTicket`, `Review`;
- `status` on `Order`, `Booking`, `Payment`, `Delivery`, `Product`, `FoodItem`, `PartnerBusiness`, `PartnerPayout`, `SupportTicket`;
- `created_at` on operational tables: `Order`, `Booking`, `Payment`, `Notification`, `SupportTicket`, `AdminLog`, `SystemLog`;
- `slug` unique on `PartnerBusiness`, `Tour`, `Stay`;
- `date` on `RoomAvailability`, `TourSchedule`;
- `room_id + date` unique on `RoomAvailability`;
- `tour_id + date` on `TourSchedule`;
- `order_id` on `OrderItem`, `Payment`, `Delivery`, `SupportTicket`, `Review`, `LoyaltyTransaction`;
- `booking_id` on `Payment`, `SupportTicket`, `Review`, `LoyaltyTransaction`;
- `cart_id` on `CartItem`;
- `is_active` on `PartnerStopStatus`;
- `entity_type + entity_id` on `AdminLog`, `SystemLog`.

## Вопросы для уточнения

- Нужна ли отдельная таблица `Address` в Stage 01C-2, так как клиентские адреса уже описаны в client cabinet, но не были включены в обязательный список Stage 01C-1?
- Нужна ли отдельная таблица `PartnerEmployee` для сотрудников партнёра и детальных permissions?
- Нужно ли разделять `FoodItem`, `Product`, `AlcoholProduct` через общий `CatalogItem` в будущем или оставить раздельные таблицы?
- Нужно ли хранить сообщения поддержки в отдельной таблице `SupportMessage` вместо `messages jsonb`?
- Будет ли `Payment` строго один к одному с заказом/бронью или нужно поддержать несколько платежей и частичные оплаты?

# DATABASE PLAN

## Назначение

Документ описывает план реальной базы данных для KÖL / Issyk-Kul Travel & Delivery Platform перед backend-интеграцией. Это planning stage: база данных не создаётся, Supabase не подключается, migrations не пишутся.

Рекомендуемый стек для реализации: Supabase / PostgreSQL с RLS, audit logs и разделением ролей.

## Compliance note

Alcohol module remains OFF by default. No alcohol delivery or sales are enabled. Activation requires legal review, licensing, partner verification and admin approval. `ALCOHOL_MODULE_ENABLED=false` до отдельного юридического решения.

## Общие правила

- Все основные таблицы имеют `id uuid primary key`, `created_at timestamptz`, `updated_at timestamptz`.
- Денежные значения: `numeric(12,2)` для читаемости отчётов и безопасных расчётов в PostgreSQL.
- Для статусов использовать enum или constrained text.
- Для расширяемых данных использовать `metadata jsonb`.
- Для удаления операционных сущностей предпочтителен soft delete: `deleted_at timestamptz`.
- Все опасные действия должны попадать в `audit_logs`.

## Users and roles

Таблицы:
- `users`
- `user_profiles`
- `user_roles`
- `client_profiles`
- `partner_profiles`
- `courier_profiles`
- `admin_profiles`

Purpose: единая идентичность пользователя, профили по ролям, расширение прав доступа без смешивания клиентских, партнёрских, курьерских и админских данных.

Key fields:
- `users`: `id`, `email`, `phone`, `auth_provider`, `status`, `last_login_at`.
- `user_profiles`: `user_id`, `full_name`, `avatar_url`, `locale`, `preferred_contact`.
- `user_roles`: `user_id`, `role`, `scope_id`, `is_active`.
- `client_profiles`: `user_id`, `default_address`, `loyalty_account_id`.
- `partner_profiles`: `user_id`, `business_id`, `position`.
- `courier_profiles`: `user_id`, `vehicle_type`, `vehicle_number`, `working_zone`, `availability_status`.
- `admin_profiles`: `user_id`, `admin_level`, `department`.

Relationships:
- `users` 1-N `user_roles`.
- `users` 1-1 optional profile tables.
- `partner_profiles.business_id` -> `partners.id`.

Read/write:
- Client reads and updates own profile.
- Partner staff reads own profile and business-scoped staff.
- Courier reads own courier profile.
- Admin reads according to admin role.
- Super admin audits everything.

MVP priority: high. Это фундамент auth, кабинетов и RLS.

## Marketplace

Таблицы:
- `partners`
- `partner_staff`
- `tours`
- `stays`
- `rooms`
- `restaurants`
- `menu_items`
- `shops`
- `products`
- `categories`
- `media_files`

Purpose: публичный каталог, партнёрский каталог, карточки туров, жилья, еды, магазина и медиа.

Key fields:
- `partners`: `id`, `owner_user_id`, `type`, `title`, `slug`, `status`, `business_status`, `location`, `rating`.
- `partner_staff`: `business_id`, `user_id`, `role`, `permissions`.
- `tours`: `business_id`, `title`, `slug`, `price`, `duration`, `status`.
- `stays`: `business_id`, `title`, `slug`, `type`, `location`, `status`.
- `rooms`: `stay_id`, `title`, `capacity`, `price_per_night`, `status`.
- `restaurants`: `business_id`, `delivery_enabled`, `working_hours`.
- `menu_items`: `business_id`, `category_id`, `title`, `price`, `status`, `preparation_time`.
- `shops`: `business_id`, `delivery_enabled`, `working_hours`.
- `products`: `business_id`, `category_id`, `title`, `price`, `stock_qty`, `status`.
- `categories`: `scope`, `title`, `slug`, `parent_id`.
- `media_files`: `owner_type`, `owner_id`, `url`, `alt`, `sort_order`.

Relationships:
- Partner owns catalog items.
- Food/products/tours/stays link to categories and media.
- Rooms belong to stays.

Read/write:
- Guests read published public catalog.
- Partners write only own catalog.
- Admin moderates all catalog.

MVP priority: high for public catalog, medium for full moderation.

## Orders

Таблицы:
- `orders`
- `order_items`
- `order_status_history`
- `order_payments`
- `order_delivery`

Purpose: заказы еды и магазина, статусы подготовки, связь с оплатой и доставкой.

Key fields:
- `orders`: `client_id`, `business_id`, `type`, `status`, `subtotal`, `delivery_fee`, `discount`, `total`, `payment_status`.
- `order_items`: `order_id`, `item_type`, `item_id`, `title_snapshot`, `qty`, `unit_price`, `total`.
- `order_status_history`: `order_id`, `from_status`, `to_status`, `changed_by`, `reason`.
- `order_payments`: `order_id`, `payment_id`, `amount`, `status`.
- `order_delivery`: `order_id`, `delivery_id`, `delivery_method`, `pickup_address`, `dropoff_address`.

Relationships:
- Client owns orders.
- Partner receives business-scoped orders.
- Delivery links after ready-for-pickup.

Read/write:
- Client reads own orders.
- Partner reads own business orders and updates preparation statuses.
- Courier reads assigned delivery-linked orders.
- Admin/support read according to role.

MVP priority: high after database/auth setup.

## Bookings

Таблицы:
- `bookings`
- `booking_guests`
- `booking_status_history`
- `room_availability`
- `tour_schedules`

Purpose: бронирование жилья и туров, защита от overbooking, календарь доступности.

Key fields:
- `bookings`: `client_id`, `business_id`, `booking_type`, `object_id`, `status`, `start_date`, `end_date`, `guests_count`, `total`.
- `booking_guests`: `booking_id`, `name`, `age_group`, `notes`.
- `booking_status_history`: `booking_id`, `from_status`, `to_status`, `changed_by`, `reason`.
- `room_availability`: `room_id`, `date`, `status`, `available_count`, `price_override`.
- `tour_schedules`: `tour_id`, `date`, `time`, `capacity`, `booked_count`, `status`.

Relationships:
- `room_availability` is source of truth for room dates.
- `tour_schedules` is source of truth for tour places and dates.

Read/write:
- Client reads own bookings.
- Partner reads and updates own business bookings.
- Admin resolves disputes.

MVP priority: high for booking checkout and cabinets.

## Delivery

Таблицы:
- `deliveries`
- `delivery_status_history`
- `courier_assignments`
- `courier_shifts`
- `courier_locations`
- `delivery_issues`

Purpose: управление физической доставкой после подготовки заказа партнёром.

Key fields:
- `deliveries`: `order_id`, `status`, `pickup_address`, `dropoff_address`, `assigned_courier_id`, `risk_level`.
- `delivery_status_history`: `delivery_id`, `from_status`, `to_status`, `changed_by`.
- `courier_assignments`: `delivery_id`, `courier_id`, `status`, `assigned_by`.
- `courier_shifts`: `courier_id`, `starts_at`, `ends_at`, `status`, `zone`.
- `courier_locations`: `courier_id`, `lat`, `lng`, `recorded_at`.
- `delivery_issues`: `delivery_id`, `category`, `priority`, `status`, `description`.

Relationships:
- Delivery belongs to order.
- Courier assignment links courier and delivery.
- AI dispatcher can write recommendations/events, not final money/cancel decisions.

Read/write:
- Courier reads assigned deliveries and updates physical delivery statuses.
- Partner sees assigned courier and delivery status for own order.
- Admin can assign/reassign and resolve issues.

MVP priority: medium-high after orders.

## Finance

Таблицы:
- `payments`
- `payouts`
- `commissions`
- `refunds`
- `transactions`

Purpose: ручные MVP-платежи, будущие online payments, комиссии, выплаты партнёрам/курьерам, возвраты.

Key fields:
- `payments`: `user_id`, `order_id`, `booking_id`, `method`, `status`, `amount`.
- `payouts`: `recipient_type`, `recipient_id`, `amount`, `status`, `period_start`, `period_end`.
- `commissions`: `business_id`, `scope`, `rate`, `fixed_amount`, `is_active`.
- `refunds`: `payment_id`, `amount`, `status`, `reason`, `approved_by`.
- `transactions`: `source_type`, `source_id`, `amount`, `direction`, `status`.

Read/write:
- Finance admins handle finance data.
- Partners read own payout summaries.
- Couriers read own earnings only.
- Clients read own payment statuses.

MVP priority: medium. Manual payment first, online later.

## CRM and support

Таблицы:
- `support_tickets`
- `ticket_messages`
- `reviews`
- `notifications`
- `audit_logs`

Purpose: поддержка, отзывы, уведомления, обязательный аудит действий.

Key fields:
- `support_tickets`: `created_by`, `related_order_id`, `related_booking_id`, `category`, `priority`, `status`.
- `ticket_messages`: `ticket_id`, `sender_id`, `message`, `visibility`.
- `reviews`: `client_id`, `business_id`, `order_id`, `booking_id`, `rating`, `text`, `status`.
- `notifications`: `user_id`, `type`, `title`, `body`, `read_at`.
- `audit_logs`: `actor_id`, `actor_role`, `action`, `entity_type`, `entity_id`, `before`, `after`.

MVP priority: medium, audit logs high.

## Promos and loyalty

Таблицы:
- `promo_codes`
- `promo_usage`
- `loyalty_accounts`
- `loyalty_transactions`
- `favorites`

Purpose: промокоды, персональные скидки, баллы и избранное.

Key fields:
- `promo_codes`: `code`, `scope`, `discount_type`, `discount_value`, `starts_at`, `ends_at`, `status`.
- `promo_usage`: `promo_code_id`, `user_id`, `order_id`, `booking_id`, `used_at`.
- `loyalty_accounts`: `user_id`, `points_balance`.
- `loyalty_transactions`: `account_id`, `type`, `points`, `source_type`, `source_id`.
- `favorites`: `user_id`, `entity_type`, `entity_id`.

MVP priority: low-medium after checkout stability.

## AI dispatcher

Таблицы:
- `ai_dispatcher_events`
- `ai_recommendations`
- `ai_alerts`
- `ai_decision_logs`

Purpose: фиксация наблюдений AI-диспетчера, рекомендаций, рисков и сообщений для human admin.

Key fields:
- `ai_dispatcher_events`: `source_type`, `source_id`, `event_type`, `risk_level`, `payload`.
- `ai_recommendations`: `event_id`, `recommended_action`, `human_approval_required`, `status`.
- `ai_alerts`: `event_id`, `recipient_role`, `message`, `status`.
- `ai_decision_logs`: `situation_summary`, `risk_level`, `who_to_notify`, `messages`, `approved_by`.

Read/write:
- AI writes recommendations/logs only.
- Admin approves high-risk actions.
- AI never changes payment status, never cancels orders without admin approval, never enables alcohol delivery.

MVP priority: medium after delivery/admin control.

## Compliance

Таблицы:
- `alcohol_module_settings`
- `compliance_reviews`

Purpose: юридически чувствительные настройки, проверки партнёров и блокировка alcohol module.

Key fields:
- `alcohol_module_settings`: `is_enabled`, `enabled_by`, `enabled_at`, `legal_review_id`, `metadata`.
- `compliance_reviews`: `entity_type`, `entity_id`, `review_type`, `status`, `reviewed_by`, `notes`.

Read/write:
- Super admin and compliance admin only.
- Default: `is_enabled=false`.

MVP priority: low. Планируется только после legal approval.

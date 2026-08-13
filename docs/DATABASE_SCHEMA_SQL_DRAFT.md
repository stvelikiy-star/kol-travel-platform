# DATABASE SCHEMA SQL DRAFT

## Назначение

Документ описывает SQL-черновики для будущей Supabase/PostgreSQL базы KÖL / Issyk-Kul Travel & Delivery Platform.

На Stage 11C SQL-файлы только созданы в репозитории. Они не запускались как migrations, не применялись к Supabase и не требуют реальных environment variables.

## Созданные SQL-файлы

### `supabase/schema/001_initial_schema.sql`

Назначение: первичный draft database schema.

Содержит:

- users and roles profile tables;
- marketplace catalog tables;
- orders and order items;
- bookings and availability;
- delivery and courier control;
- finance tables;
- CRM/support/reviews/notifications/audit logs;
- promos and loyalty;
- AI dispatcher events/recommendations/alerts/logs;
- compliance tables;
- indexes for important relations;
- comments for critical rules.

Важное правило: `alcohol_module_settings.is_enabled` имеет default `false`.

### `supabase/schema/002_rls_policies_draft.sql`

Назначение: draft RLS strategy.

Содержит:

- `enable row level security` для основных таблиц;
- helper functions draft: `has_role`, `is_admin`, `is_finance_admin`, `is_partner_for`, `is_assigned_courier`;
- client own data policies;
- partner own business policies;
- courier assigned delivery policies;
- finance restricted policies;
- AI dispatcher recommendation/log policies;
- alcohol module lock comments.

Важно: RLS является черновиком и должен быть протестирован в отдельном Supabase project before production.

### `supabase/schema/003_seed_demo_data_draft.sql`

Назначение: demo seed data draft.

Содержит:

- demo admin;
- demo client;
- demo partner;
- demo courier;
- demo tour;
- demo stay and room;
- demo restaurant/menu item;
- demo shop/product;
- demo order;
- demo booking;
- demo delivery;
- demo AI recommendation;
- disabled alcohol module setting.

Seed data is demo only. В реальном Supabase project `auth.users` создаётся через Supabase Auth, поэтому demo UUIDs нужно заменить или подготовить auth seed отдельно.

## Что проверить перед применением

Перед реальной миграцией нужно проверить:

- порядок создания таблиц и foreign keys;
- Supabase Auth dependency на `auth.users`;
- необходимость enum types вместо `text` status fields;
- все unique constraints;
- все indexes под реальные query patterns;
- `updated_at` triggers и idempotency миграций;
- RLS policies на positive and negative cases;
- service role usage;
- audit log coverage;
- finance access restrictions;
- AI dispatcher limitations;
- alcohol module lock.

## Что нужно доработать перед production

- Перевести draft SQL в полноценные Supabase migrations.
- Добавить enum values или check constraints для статусов.
- Добавить тесты RLS.
- Добавить SQL functions для безопасного checkout и booking availability lock.
- Добавить transaction-safe protection from overbooking.
- Добавить строгие policies для insert/update/delete.
- Разделить support/admin/finance scopes детальнее.
- Добавить storage policies для media files.
- Добавить backup and monitoring plan.

## RLS testing checklist

Минимальные тесты:

- client не видит чужие orders/bookings/profile;
- partner не видит чужой business/catalog/orders/bookings;
- courier видит только assigned deliveries;
- finance admin видит finance data, support admin не видит finance data;
- AI может создавать recommendations/logs, но не может менять orders/payments;
- admin видит нужные operational records;
- service role key не используется в browser code.

## Alcohol compliance

Alcohol module is OFF by default.

No alcohol delivery or sales are enabled.

Activation requires:

- legal review;
- licensing;
- partner verification;
- age gate and age check flow;
- admin approval;
- audit log;
- explicit change of `ALCOHOL_MODULE_ENABLED=true` and database setting after approval.

До этого момента alcohol routes/products/orders must remain hidden or disabled.

## Service role key safety

`SUPABASE_SERVICE_ROLE_KEY`:

- must never be exposed to browser;
- must not be prefixed with `NEXT_PUBLIC_`;
- must only be used server-side;
- must not be logged;
- must be rotated if exposed.

## Итог

SQL files are ready for review, not for production execution. Следующий шаг: Stage 11D — Data Access Layer Mock-to-Real Preparation.

# SUPABASE SETUP GUIDE

## Назначение

Документ описывает подготовку Supabase для KÖL / Issyk-Kul Travel & Delivery Platform. На Stage 11B реальный проект Supabase не подключается, пакет `@supabase/supabase-js` не добавляется, auth не включается в приложении.

## Compliance note

Alcohol module remains OFF by default. No alcohol delivery or sales are enabled. Activation requires legal review, licensing, partner verification and admin approval. `ALCOHOL_MODULE_ENABLED=false`.

## 1. Создать Supabase project later

Когда начнётся реальная backend-интеграция:

1. Создать новый Supabase project.
2. Выбрать регион ближе к целевой аудитории и инфраструктуре.
3. Сохранить project URL.
4. Сохранить anon key.
5. Сохранить service role key только для server-side окружения.

Важно: service role key must never be exposed to browser.

## 2. Добавить environment variables

Для local development:

- `NEXT_PUBLIC_SUPABASE_URL`;
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
- `SUPABASE_SERVICE_ROLE_KEY`;
- `DATABASE_URL`;
- `NEXT_PUBLIC_APP_URL=http://localhost:3000`;
- `ALCOHOL_MODULE_ENABLED=false`.

Для production:

- использовать секреты платформы деплоя;
- не хранить service role key в клиентском bundle;
- проверить, что `ALCOHOL_MODULE_ENABLED=false`, пока нет legal approval.

## 3. Создать tables later

Схема будет создаваться на следующих этапах на основе:

- `docs/DATABASE_SCHEMA.md`;
- `docs/DATABASE_PLAN.md`;
- `docs/ROW_LEVEL_SECURITY_PLAN.md`.

Основные группы:

- users and roles;
- marketplace catalog;
- orders;
- bookings;
- delivery;
- finance;
- support and CRM;
- promos and loyalty;
- AI dispatcher;
- compliance.

## 4. Enable Auth later

Auth не включается на Stage 11B.

План later:

- выбрать Supabase Auth или Auth.js;
- настроить email/phone login;
- добавить role assignment после регистрации;
- разделить client, partner, courier and admin dashboards;
- добавить middleware/protected routes later;
- не ломать demo UI during migration.

## 5. Configure RLS later

RLS должен быть включён до production data.

Минимальные правила:

- clients only see own orders/bookings/profile;
- partners only see own business/catalog/orders/bookings;
- couriers only see assigned deliveries;
- finance data restricted;
- AI dispatcher can write recommendations/logs only;
- admins scoped by admin role;
- service role key used only server-side.

## 6. Local dev safety

Stage 11B files in `src/lib/supabase` are placeholders:

- they do not create a real Supabase client;
- they do not require env vars;
- they do not fetch data;
- they are safe for current mock UI.

Before connecting real client:

- install Supabase package in a dedicated stage;
- verify env vars;
- add server-only guards;
- add tests for missing env behavior;
- keep mock fallback until real data is stable.

## 7. Service role key safety

Rules:

- never use `SUPABASE_SERVICE_ROLE_KEY` in client components;
- never prefix service role key with `NEXT_PUBLIC_`;
- use it only in route handlers/server actions/server utilities;
- avoid logging it;
- rotate it if exposed;
- restrict usage to admin operations that require elevated access.

## 8. Alcohol module lock

No alcohol delivery or sales are enabled.

Before any activation:

- legal review;
- license verification;
- partner verification;
- age gate and age check;
- admin approval;
- audit log;
- explicit `ALCOHOL_MODULE_ENABLED=true` only after approval.

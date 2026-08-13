# Supabase Read Adapters Draft

## Статус Stage 12C

Создан черновой read-only слой для будущего режима `DATA_SOURCE_MODE=supabase`. На этом этапе реальные запросы к Supabase не выполняются, mock mode остается режимом по умолчанию.

## Что создано

Файл `src/lib/data/supabase-read-adapter.ts` содержит безопасные draft-функции:

- чтение заказов и одного заказа;
- чтение броней и одной брони;
- чтение туров, жилья, еды, товаров и партнеров;
- чтение доставок;
- чтение admin dashboard summary.

Все функции работают только как read adapters. Они не создают, не обновляют и не удаляют данные.

## Mock Fallback

Основной data layer теперь проверяет `isSupabaseMode()`.

- Если режим `mock`, поведение остается прежним.
- Если режим `supabase`, data layer пробует вызвать draft adapter.
- Если adapter возвращает пустой/безопасный результат, data layer fallback возвращает mock data, чтобы UI не ломался.

Это временное поведение для безопасной подготовки. Когда реальные Supabase queries будут протестированы, fallback-логику можно будет ужесточить по страницам.

## Почему пока нет write actions

Write actions не добавлены намеренно:

- нет production RLS verification;
- нет auth/session enforcement;
- нет audit logs на реальные mutations;
- нет human approval flow для risky operations;
- платежи и refunds не подключены;
- AI dispatcher не должен выполнять действия напрямую.

## Как будет работать Supabase Mode позже

Позже включение будет выглядеть так:

```env
DATA_SOURCE_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Перед включением нужно:

1. Проверить schema из `supabase/schema/001_initial_schema.sql`.
2. Протестировать RLS policies.
3. Добавить реальные typed SELECT queries в read adapter.
4. Проверить public pages, dashboards и detail routes.
5. Оставить rollback через `DATA_SOURCE_MODE=mock`.

## Security Warnings

- `SUPABASE_SERVICE_ROLE_KEY` должен оставаться server-only.
- RLS must be tested before real user data appears.
- AI dispatcher может только рекомендовать действия до отдельного approval workflow.
- AI не отменяет заказы и не меняет payment status.
- `ALCOHOL_MODULE_ENABLED=false` остается default.
- Alcohol sales/delivery не включены; запуск требует legal review, licensing, partner verification и admin approval.

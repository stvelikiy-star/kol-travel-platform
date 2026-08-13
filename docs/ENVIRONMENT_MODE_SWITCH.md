# Environment Mode Switch

## Статус Stage 12B

Платформа KOL подготовлена к безопасному переключению между mock-данными и будущими Supabase-адаптерами. Реальное подключение Supabase на этом этапе не выполняется.

## DATA_SOURCE_MODE

Переменная окружения:

```env
DATA_SOURCE_MODE=mock
```

Допустимые значения:

- `mock` - режим по умолчанию, использует локальные mock data из `src/data` через data access layer.
- `supabase` - будущий режим для чтения данных из Supabase/PostgreSQL.

Если переменная отсутствует или содержит неизвестное значение, приложение безопасно возвращается в `mock`.

## Mock Mode

`DATA_SOURCE_MODE=mock` должен оставаться режимом по умолчанию до реальной backend-интеграции.

В этом режиме:

- сайт компилируется без Supabase env vars;
- UI продолжает использовать локальные demo данные;
- auth, платежи, Telegram, n8n и real CRM actions не подключаются;
- отсутствует риск случайного обращения к production database.

## Supabase Mode Later

`DATA_SOURCE_MODE=supabase` будет использоваться позже, когда появятся реальные read adapters и проверенные RLS policies.

Для будущего Supabase mode понадобятся:

- `NEXT_PUBLIC_SUPABASE_URL` - browser-safe URL проекта;
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - browser-safe anon key;
- `SUPABASE_SERVICE_ROLE_KEY` - server-only ключ для строго ограниченных backend operations;
- возможно `SUPABASE_URL` и `SUPABASE_ANON_KEY` для server runtime.

На Stage 12B эти переменные могут быть пустыми. Supabase client/server helpers не должны падать при импорте.

## Rollback Plan

Если будущий Supabase mode даст ошибку:

1. Установить `DATA_SOURCE_MODE=mock`.
2. Перезапустить dev server или redeploy.
3. Проверить, что каталоги и кабинеты снова используют mock data.
4. Разбирать Supabase ошибку отдельно, не ломая публичный UI.

## Safety Rules

- Приложение должно собираться без Supabase env vars.
- `SUPABASE_SERVICE_ROLE_KEY` используется только на сервере и никогда не попадает в browser bundle.
- AI dispatcher остается demo/recommendation-only до отдельной backend-интеграции.
- AI не отменяет заказы и не меняет payment status.
- `ALCOHOL_MODULE_ENABLED=false` остается значением по умолчанию.
- Alcohol sales/delivery не включены; активация возможна только после юридической проверки, лицензирования, partner verification и admin approval.

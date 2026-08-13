# Supabase Manual Setup Step By Step

Этот документ помогает вручную подготовить Supabase TEST project для KOL. Он не подключает приложение к Supabase автоматически и не содержит реальных секретов.

## 1. Создать Test Project

1. Откройте Supabase Dashboard.
2. Создайте новый проект с именем `kol-travel-platform-test`.
3. Убедитесь, что это тестовый проект, а не production.
4. Не переключайте приложение на Supabase mode на этом этапе.

## 2. Найти Project URL И Keys

В Supabase Dashboard откройте Project Settings -> API.

Найдите:

- Project URL -> для `NEXT_PUBLIC_SUPABASE_URL`
- Publishable key / anon key -> для `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- service_role key -> для `SUPABASE_SERVICE_ROLE_KEY`

Service role key является приватным серверным секретом. Никогда не вставляйте его в браузерный код, чат, README или публичные файлы.

## 3. Создать `.env.local`

1. Скопируйте `.env.local.template` в `.env.local`.
2. Вставьте реальные значения только в `.env.local`.
3. Не коммитьте `.env.local`.
4. Оставьте:

```env
DATA_SOURCE_MODE=mock
ALCOHOL_MODULE_ENABLED=false
```

## 4. Проверить Локальную Сборку

Запустите:

```bash
npm run build
npm run check:supabase-env
npm run check:supabase-schema-files
```

`check:supabase-env` может показать, что `.env.local` отсутствует. Это нормально, если вы ещё не создали его вручную.

## 5. SQL Выполнять Только Вручную

SQL выполняется вручную в Supabase SQL Editor и только в test project.

Порядок:

1. `supabase/schema/001_initial_schema.sql`
2. `supabase/schema/002_rls_policies_draft.sql`
3. `supabase/schema/003_seed_demo_data_draft.sql`

Если любой SQL-файл падает с ошибкой, остановитесь и не запускайте следующий файл.

## 6. Безопасность

- Не используйте real client data.
- Не используйте real payment data.
- Не коммитьте `.env.local`.
- Не печатайте service role key.
- Не переключайте `DATA_SOURCE_MODE=supabase`, пока SQL, RLS и seed не проверены.
- `ALCOHOL_MODULE_ENABLED=false` должен оставаться выключенным.

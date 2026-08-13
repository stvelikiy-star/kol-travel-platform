# Supabase SQL Run Order

SQL нужно запускать вручную в Supabase SQL Editor и только в test project.

## Порядок Запуска

1. `supabase/schema/001_initial_schema.sql`
2. `supabase/schema/002_rls_policies_draft.sql`
3. `supabase/schema/003_seed_demo_data_draft.sql`

Если любой SQL-файл падает с ошибкой, остановитесь и не запускайте следующий файл. Сначала исправьте проблему в test project.

## Combined File

Для удобства создан файл:

- `supabase/schema/combined_manual_setup.sql`

Он объединяет 001, 002 и 003 с большими комментариями между секциями:

- `-- SECTION 001 INITIAL SCHEMA`
- `-- SECTION 002 RLS POLICIES`
- `-- SECTION 003 SEED DEMO DATA`

Рекомендуемый безопасный путь: запускать отдельные SQL-файлы по порядку. Combined-файл нужен только для ручного копирования, если вы понимаете последствия. Если combined-файл или отдельные SQL-файлы дают ошибку, остановитесь.

## Safety Rules

- Не запускайте SQL в production.
- Не вставляйте service role key в SQL Editor.
- Не переключайте `DATA_SOURCE_MODE=supabase` до проверки schema/RLS/seed.
- `ALCOHOL_MODULE_ENABLED=false` остаётся default.

## Fixed Seed Fallback

If `003_seed_demo_data_draft.sql` fails with `user_profiles_user_id_fkey`, use:

- `supabase/schema/003_seed_demo_data_draft_FIXED.sql`

Do not run the original 003 repeatedly if it failed halfway.

For a test project, the safest path is:

1. Reset public schema in the Supabase TEST project.
2. Run `001_initial_schema.sql`.
3. Run `002_rls_policies_draft.sql`.
4. Run `003_seed_demo_data_draft_FIXED.sql`.

# KÖL — реестр согласования миграций и окружений
**Проверено:** 22 ноября 2026 года. **База:** `kol-travel-platform-test`, `mphruawzozrpwcjgejhs`. **Исходная ветка:** `release/kol-unified-p0-20261120`, SHA `e9182a2b57c207cb79d180833b4b6aef882b6a54`.

> **Результат:** в управляемой PostgreSQL зарегистрировано 35 миграций. В каталоге `supabase/migrations/` есть ровно три версии с совпадающими номерами. Для 24 записей найдены исходники с похожей семантикой, но **нет доказательства идентичности применённого SQL**. Для 8 записей исходное тело SQL не установлено. Воспроизведение текущей облачной схемы **только из версионированных миграций не доказано**.

Сохранённый машиночитаемый реестр с полными путями и Git blob SHA: `ops/migration-reconciliation/kol-managed-ledger-20261122.json`. Его категории не должны автоматически превращаться в `supabase/migrations/`.

## 1. Постатейная сверка 35 миграций

| Версия | Имя в Supabase | Степень подтверждения | Возможный источник в репозитории |
|---|---|---|---|
| `20260924060622` | `security_hardening_phase1_20260924` | Кандидат, SQL не сверён | `schema/005_security_hardening_DRAFT_NOT_APPLIED.sql` |
| `20260924060745` | `auth_profile_rls_minimal_20260924` | Исходник не найден | — |
| `20260924061353` | `mvp_support_read_rls_20260924` | Исходник не найден | — |
| `20260924061357` | `client_support_runtime_20260924` | Кандидат, SQL не сверён | `schema/021_client_support_runtime_DRAFT_NOT_APPLIED.sql` |
| `20260924061403` | `admin_support_lifecycle_20260924` | Кандидат, SQL не сверён | `schema/022_admin_support_lifecycle_DRAFT_NOT_APPLIED.sql` |
| `20260925051259` | `public_intake_requests_mvp_20260925` | Кандидат, SQL не сверён | `schema/027_public_intake_payload_DRAFT_NOT_APPLIED.sql` |
| `20260925051615` | `temporary_auth_bootstrap_token_store_20260925` | Исходник не найден | — |
| `20260925051647` | `remove_unused_auth_bootstrap_token_store_20260925` | Исходник не найден | — |
| `20260925052929` | `harden_public_intake_validation_20260925` | Исходник не найден | — |
| `20260925053800` | `restore_audited_admin_intake_lifecycle_20260925` | Исходник не найден | — |
| `20260928065214` | `client_stay_booking_atomic_v1` | Кандидат, SQL не сверён | `schema/023_client_stay_booking_atomic_APPLIED_STAGING.sql` |
| `20261007130434` | `010_fk_index_baseline` | Кандидат, SQL не сверён | `schema/010_fk_index_baseline_DRAFT_NOT_APPLIED.sql` |
| `20261007130525` | `006b_rls_initplan_scope_hardening` | Кандидат, SQL не сверён | `schema/006b_rls_initplan_scope_hardening_DRAFT_NOT_APPLIED.sql` |
| `20261007131749` | `006a_audit_log_write_lockdown` | Кандидат, SQL не сверён | `schema/006a_audit_log_write_lockdown_DRAFT_NOT_APPLIED.sql` |
| `20261007133920` | `order_booking_auth_uid_initplan_hardening` | Исходник не найден | — |
| `20261007190013` | `client_onboarding_atomic_20261008` | Кандидат, SQL не сверён | `schema/025_client_onboarding_atomic_DRAFT_NOT_APPLIED.sql` |
| `20261007193325` | `support_queue_admin_read_20261008` | Исходник не найден | — |
| `20261119132246` | `kol_verified_runtime_20261119_no_storage_object_policy` | Кандидат, SQL не сверён | `ops/kol-production-runtime-delta-20261119.sql` |
| `20261120061152` | `courier_delivery_issue_read_access` | Номер совпадает¹ | `migrations/20261120061152_courier_delivery_issue_read_access.sql` |
| `20261120063622` | `admin_delivery_issue_lifecycle` | Номер совпадает¹ | `migrations/20261120063622_admin_delivery_issue_lifecycle.sql` |
| `20261120070116` | `courier_issue_insert_validation` | Номер совпадает¹ | `migrations/20261120070116_courier_issue_insert_validation.sql` |
| `20261121062534` | `kol_finance_analytics_read_v1_20261121` | Кандидат, SQL не сверён | `ops/kol-finance-analytics-read-v1-20261121.sql` |
| `20261121065239` | `kol_046a_content_ads_core_20261121` | Кандидат, SQL не сверён | `ops/kol-content-admin-core-20261121.sql` |
| `20261121065247` | `kol_046b_verified_reviews_20261121` | Кандидат, SQL не сверён | `ops/kol-verified-reviews-20261121.sql` |
| `20261121065256` | `kol_046c_content_publish_actions_20261121` | Кандидат, SQL не сверён | `ops/kol-content-publish-rpc-20261121.sql` |
| `20261121065656` | `kol_046d_public_rls_column_privacy_20261121` | Кандидат, SQL не сверён | `ops/kol-public-api-privacy-20261121.sql` |
| `20261121070434` | `kol_046e_review_insert_audit_20261121` | Кандидат, SQL не сверён | `ops/kol-review-insert-audit-20261121.sql` |
| `20261121070651` | `kol_046f_paid_ad_identity_lock_20261121` | Кандидат, SQL не сверён | `ops/kol-ad-payment-immutability-20261121.sql` |
| `20261121072219` | `kol_047_commission_terms_preview_20261121` | Кандидат, SQL не сверён | `ops/kol-finance-contract-settlement-preview-v1-20261121.sql` |
| `20261121074742` | `kol_048_verified_double_entry_recognition_20261121` | Кандидат, SQL не сверён | `ops/kol-double-entry-recognition-ledger-20261121.sql` |
| `20261121075329` | `kol_049_immutable_finance_request_approval_20261121` | Кандидат, SQL не сверён | `ops/kol-finance-request-approval-workflow-20261121.sql` |
| `20261121090729` | `kol_050_owner_cost_accrual_reversal_20261121` | Кандидат, SQL не сверён | `ops/kol-owner-cost-accrual-reversal-v1-20261121.sql` |
| `20261121092224` | `kol_051_operations_analytics_20261121` | Кандидат, SQL не сверён | `ops/kol-operations-analytics-v1-20261121.sql` |
| `20261121092846` | `kol_052_stay_review_listing_id_20261121` | Кандидат, SQL не сверён | `ops/kol-stay-review-listing-id-20261121.sql` |
| `20261121153446` | `kol_legacy_booking_audit_key_unique_20261121` | Кандидат, SQL не сверён | `ops/kol-legacy-booking-audit-key-unique-20261121.sql` |

¹ Совпадение версии и пути файла **не доказывает** побайтового совпадения с исторически исполненным SQL, потому что таблица `supabase_migrations.schema_migrations` хранит только версию/имя.

**8 записей без подтверждённого исходника:** `auth_profile_rls_minimal_20260924`; `mvp_support_read_rls_20260924`; `temporary_auth_bootstrap_token_store_20260925`; `remove_unused_auth_bootstrap_token_store_20260925`; `harden_public_intake_validation_20260925`; `restore_audited_admin_intake_lifecycle_20260925`; `order_booking_auth_uid_initplan_hardening`; `support_queue_admin_read_20261008`.

**Важные ограничения:** `DRAFT_NOT_APPLIED` в имени остаётся явным предупреждением. Даже если связанное поведение обнаружено в облаке, нельзя запускать черновик повторно или объявлять его исходным применённым миграционным файлом без сверки. Среди кандидатов `kol-production-runtime-delta-20261119.sql` — крупный пакет, а не гарантированный побайтный источник миграции `20261119132246`.

## 2. Что уже проверено и чего нет

- **Подтверждено:** отдельный workflow `live-backup-restore-rehearsal.yml` создал зашифрованную копию тестовой облачной PostgreSQL и восстановил её на отдельной базе (run `44935295104`); сведения о 35 миграциях сохранены вместе со схемой.
- **Исторический пакет:** `supabase/staging/migration-plan.json` и `ops/ubuntu/live/migration-bundle.json.zlib` содержат **44 APPLY + 74 VERIFY**, но `managed-baseline-gate` допускает **только старую форму 54 таблицы / 17 миграций**. Нынешняя управляемая TEST содержит **69 таблиц / 35 миграций**. Применять исторические 44 шага поверх неё нельзя. Добавлен ранний STOP в `scripts/qa-kol-persistent-migrations.py`; run `44978059679` ранее остановился из-за слишком строгой проверки пустого Storage, а этот исторический план всё равно не предназначен для текущего источника.
- **Строгое различие:** восстановление **полного дампа** не доказывает, что с нуля можно применить **ровно 35 исторических миграций**. И успешный `44 APPLY + 74 VERIFY` на восстановленной копии не заменяет сверку всех 35 тел исторических SQL.
- **Новые ручные изменения:** SQL-патчи `kol-auth-legacy-null-repair-20261122.sql` и `kol-stay-inventory-missing-day-failclosed-20261122.sql` были применены на TEST отдельно. Они представлены в `ops/release-sql/`, но не записаны в управляемый журнал из 35 миграций. Перед новой production-схемой их необходимо учесть и проверить как отдельную ревизию, **не добавляя фиктивных записей в журнал задним числом**.
- **Storage фактически на 22.11:** `1` приватный bucket `catalog-media` (лимит 8 МБ, JPEG/PNG/WebP/AVIF) и `0` объектов. Ранний сценарий ошибочно отвергал само существование пустого bucket. Исправлена проверка в `kol_persistent_restore.py`: допустим только ноль bucket или один пустой `catalog-media` с проверкой полного контракта после восстановления; наличие любого object по-прежнему жёстко блокирует сценарий. Текущую `69/35` базу проверять через `live-backup-restore-rehearsal.yml`, не через исторический `kol-persistent-migration-proof.yml`.

- **Storage:** ранее созданные процедуры резервирования удостоверяют метаданные; при появлении файлов в `storage.objects` требуется отдельный бэкап и восстановление самих объектов. Без этого PASS дампа недостаточен.

## 3. Защитные границы

1. Нельзя выполнять `supabase db reset`, `migration repair`, массовое повторное применение `DRAFT_NOT_APPLIED` или `DROP` в действующей тестовой базе.
2. Нельзя переносить миграционную историю напрямую из TEST в новую базу без проверки исходных SQL и совместимости. Не подменять 8 отсутствующих исходников вымышленным SQL.
3. Выполнять поиск исторических текстов в исходных PR/коммитах и старых миграционных артефактах. Для необнаруженных — создать **новый** канонический baseline из read-only `pg_dump --schema-only`, а не имитацию задним числом.
4. Независимо проверить роли `anon`, `authenticated` и `service_role`, `SECURITY DEFINER`, RLS, Storage, триггеры, уникальные ключи бронирований, логи Auth и платёжные функции.
5. Воспроизвести **пустая база → проверенный baseline → следующие проверенные изменения → постпроверка**, затем сравнить `pg_get_functiondef`, `pg_policies`, grants, triggers, индексы, ограничения и расширения с TEST; только после этого разрешать новую Production-базу.

## 4. QA и Production

На 22.11.2026 единственный доступный активный проект Supabase КЁЛь — `kol-travel-platform-test`; отдельно работающая production-БД КЁЛь не подтверждена. Vercel `kol-launch-staging-20260925` имеет переменные `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, назначенные **одновременно** Preview и Production. URL/ключ нельзя считать изолированными по одному имени окружения.

**Правила перехода:** до создания отдельного Production-проекта (может быть платным), выбора Supabase-организации и успешной миграционной репетиции **не менять** общие URL/ключи, данные Preview или публичный DNS. Секреты не включать в GitHub-документацию, чат, журналы или временные артефакты. `PRODUCTION_RUNTIME_IMPLEMENTATION_READY` оставлять `false`.

## 5. Следующая последовательность

1. Сохранить исходники / полный дамп схемы и проверить целостность вне GitHub; приложить хеши и доказательство восстановления.
2. Для каждой из 8 исторических записей найти исходный SQL в прежних PR/бандлах либо записать причину невозможности восстановления. 24 кандидата проверить поблочно с `pg_get_functiondef`, `pg_policies`, индексами и grants.
3. Повторить управляемый disposable replay, получить формальный результат `44 APPLY + 74 VERIFY`; исходную TEST-базу не менять.
4. Создать и испытать **новый** канонический baseline, который воспроизводит текущую схему из пустой базы, и оформить последующие миграции без скрытого ручного SQL.
5. После выбора владельцем организации/стоимости Production в Supabase создать отдельный проект, отделить секреты и Vercel env scopes, повторить cloud E2E и backup/restore.
6. Только затем переходить к production-runtime, коммерческим данным, платежам, дизайну #129 и `kol.on.kg`.

**Гейт:** migration_reconciliation = **IN_PROGRESS**; clean_room_rebuild = **NOT_YET_PROVEN**; production = **NO-GO**.

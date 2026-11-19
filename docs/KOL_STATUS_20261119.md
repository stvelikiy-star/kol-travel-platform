# KÖL — состояние изолированного технического релиза на 19.11.2026

> **DRAFT / НЕ ЗАПУСКАТЬ / NO MERGE / NO DEPLOY.**
> Все результаты ниже относятся только к исходникам, локальным GitHub Actions runners и одноразовой Supabase. Никакие выводы не распространяются на живую базу или домен.

**Репозиторий:** `stvelikiy-star/kol-travel-platform`  
**База:** `release/kol-consolidated-gate-20261117`, исходный SHA `7b8362f7b7caf460c0c02aa647746784fd2640f0`.  
**Единственная рабочая ветка:** `audit/kol-p0-hardening-isolated-20261119-gpt6`.  
**Полный подтверждённый кодовый CI SHA (11/11):** `1be3ec8f0a084aaca133593302571dace5d57d0e`.  
**Дополнительно: полный `npm run check:release-source` PASS на workflow SHA:** `79797a643309aec58c85ac0fee13eb30fa67dd30`.  
**PR:** [Draft #168](https://github.com/stvelikiy-star/kol-travel-platform/pull/168).  
После обновления этого документа новый HEAD может отличаться от проверенного SHA; документ не означает автоматический перенос результата CI на новый HEAD.

## Общая матрица доказательств

| Область | Результат | Проверяемый источник/граница |
|---|---|---|
| GitHub PR CI | **11/11 SUCCESS на кодовом SHA** | [Actions для PR #168](https://github.com/stvelikiy-star/kol-travel-platform/pull/168/checks) |
| Статическая проверка экспортируемых actions | **PASS** | `scripts/check-server-action-authorization.mjs`; 39 файлов, 90 экспортов в исходном прогоне, включая явно проверенные demo-заглушки. Один недостаток в `clientBookings.ts` исправлен: добавлен `requireClient`. |
| Атомарный лимит публичных заявок | **PASS — disposable PG** | [Local Supabase Staging Smoke](https://github.com/stvelikiy-star/kol-travel-platform/actions/runs/44467420111), `scripts/qa-local-public-intake-atomic.mjs`: 10 одновременных, **4 inserted, 6 rate_limited**; смена телефона при том же IP запрещена; lost-response replay, conflict, invalid UUID — PASS. |
| Публичная заявка через UI | **PASS — disposable PG** | Анонимный браузер → server action → реальный ticket в локальной базе; replay без дубля, конфликт чужого payload, анонимное чтение очереди запрещено. |
| Оператор заявки | **PASS — disposable JWT** | Тот же ticket ID → отдельный локальный оператор с настоящим GoTrue JWT → status `in_progress` и audit. Service-role не использован в браузере. |
| Production/mock 503 | **PASS — локальный тест** | `qa-production-route-isolation.mjs`: `/admin`, `/owner`, `/partner`, `/courier` возвращают 503 при обоих production-маркерах; CSP Report-Only присутствует, HSTS на HTTP отсутствует. |
| Мобильные размеры, локали | **PASS — локальный Playwright** | `qa-mobile-tap-targets.mjs`: ширины 320/375/390/430/1440; RU/KG/EN, минимум 44 px и отсутствие overflow на проверяемых маршрутах. |
| CSP Report-Only, сцена, кабинеты | **PASS — локальный Playwright** | [Visual QA](https://github.com/stvelikiy-star/kol-travel-platform/actions/runs/44467420061), `qa-csp-report-only.mjs`: 11 маршрутов, **0 зарегистрированных нарушений**, сцена `/kol-stage/scene.html` и кабинеты не сломаны. CSP остаётся Report-Only. |
| 44 миграционных APPLY/VERIFY + 999 + role isolation | **PASS — восстановленная из репозитория синтетическая одноразовая локальная схема** | `run-local-supabase-staging-smoke.sh`, план `supabase/staging/migration-plan.json`. Это **НЕ** проверка восстановленной копии рабочей базы. |
| 17-мigration исторический baseline | **NOT VERIFIED** | `qa-disposable-restored-migration-plan.mjs` подготовлен с требованием localhost 54322, явного disposable-подтверждения, точных 17 пар `version+name`, 44 APPLY+VERIFY и JSON PASS/FAIL по шагам. Независимый восстановленный baseline не предоставлен. |
| Реальный сквозной JWT путь до курьера **по одной заявке** | **NOT VERIFIED** | Первые два звена (заявка → оператор) проверены; другие локальные тесты подтверждают partner A/B ACL, действия заказов и курьера **на отдельных fixture-операциях**. Не следует выдавать их за один end-to-end ID. |
| Защита на реальном ingress, HTTPS/HSTS, живая Supabase | **NOT VERIFIED / намеренно не проверялось** | Настройки production не изменялись. |
| Фактическое выполнение `npm run check:release-source` как одной команды | **PASS на SHA `79797a643309aec58c85ac0fee13eb30fa67dd30`** | [KOL CI / 44468523136](https://github.com/stvelikiy-star/kol-travel-platform/actions/runs/44468523136): полный агрегирующий шаг завершился SUCCESS, включая audit, lint, tsc, build и локальную проверку 503. |

## Что именно изменено

1. `src/app/actions/public/intake.ts`, три публичные формы и hook повтора: HMAC-хеш IP, отдельный phone-лимит, доверенный header из окружения, fail-closed, form honeypot и time-signal, RU/KG/EN, атомарная RPC и идемпотентность.
2. `supabase/schema/033_public_intake_atomic_rate_limit_DRAFT_NOT_APPLIED.sql` и `033_public_intake_atomic_rate_limit_VERIFY.sql`: SQL **только DRAFT** для разрешённого одноразового CI. Ни разу не применялся к общей/живой базе.
3. `src/proxy.ts`: CSP Report-Only, источники Supabase и шрифтов, безопасное same-origin frame-поведение сцены, HSTS только production+HTTPS.
4. Проверка всех экспортов `src/app/actions/**`; для `createStayBookingAction` добавлено подтверждение клиентской роли `requireClient`.
5. Тесты production/mock HTTP 503, concurrency и replay, JWT-оператор, мобильные tap targets и CSP. Тесты интегрированы в уже существующие GitHub Actions.
6. Усилен скрипт restored-17: сверяются **точные 17 записей** миграционного журнала из исторического restore rehearsal, а не только их количество; локальный шаг 009 поднимает bucket через существующий local-only API.

## Различие 42 / 44

Историческое задание упоминало 42 шага. Фактический текущий `supabase/staging/migration-plan.json` содержит **44** APPLY. Отбрасывать или объединять два шага нельзя до отдельной сверки. Локальный smoke прогоняет весь текущий манифест, restored-17 ещё не пройден.

## Оставшиеся блокеры и условия приёмки

1. **P0: restored historical source.** Получить уже существующий зашифрованный backup **без обращения к живой базе в рамках этой работы**, восстановить в специально выделенный disposable local Supabase и запустить весь 44-шаговый план по точному журналу из 17 применённых миграций, плюс 999 и `restored_role_isolation_TEST`. Без этого — NOT VERIFIED.
2. **P0: единый путь заказа и доставки.** Требуется подтвердить фактическую связь публичной заявки с создаваемым оператором заказом/бронью, партнёром A, отказом доступа партнёру B, назначением курьера и завершением. Существующие действия оператора для заявки (`adminSupportFormAction`) обрабатывают ответ/статус и не доказывают конвертацию заявки в заказ. Новые бизнес-функции без отдельного согласования не добавлять.
3. **P0: доверенный ingress IP.** `KOL_INTAKE_TRUSTED_IP_HEADER` допустим только когда внешний ingress удаляет заголовок клиента и устанавливает собственный. Локальный `x-forwarded-for` разрешён **только** в одноразовом тестовом окружении. Без этой проверки production заявка должна продолжать отказывать.
4. **P1: релизные проверки.** Выполнить отдельно агрегирующий `npm run check:release-source` и визуальную приёмку на реальном устройстве после согласования, **без запуска сейчас**.
5. **NO-GO:** до независимого восстановления backup, подтверждения коммерческой доступности/партнёров, домена и полного real-JWT E2E публикация запрещена.

## Неприкосновенные границы

Живая Supabase, Ubuntu, Docker на сервере, Vercel, MARINA SMART, AI PROF, n8n, Аска Таш, реальные данные, старые ветки и `main` **не тронуты**. `DATA_SOURCE_MODE` и `KOL_PRODUCTION_RUNTIME_READY` не менялись. AI (#128), алкоголь, оплата, возвраты и выплаты не включались. Демо-маркеры сохранены; production продолжает fail-closed 503.

## Предыдущие документы (не удалены)

- [Консолидированный gate-аудит 17.11](KOL_CONSOLIDATED_GATE_AUDIT_20261117.md)
- [MVP safe launch](KOL_MVP_SAFE_LAUNCH_2026-09-24.md)
- [План миграций](../supabase/staging/migration-plan.json)
- [Read-only backup/restore rehearsal CI](../.github/workflows/live-backup-restore-rehearsal.yml)
- [Локальная Supabase CI](../.github/workflows/local-supabase-smoke.yml)
- [Логика заказа](KOL_ORDER_CORE_V2_2026-08-20.md)

## Дополнение 19.11 — поиск независимого архива и полная матрица ролей

### Исторический источник обнаружен, новый restore NOT VERIFIED

- В личной библиотеке владельца проекта найден самостоятельный архив `KOL_ENCRYPTED_RECOVERY_2026-10-29.zip` (45 083 байт).
- Он включает `kol-live-baseline-20261029T152908Z.tar.gz.enc` (39 536 байт) и подписанные SHA256SUMS/текстовые свидетельства. Все **9/9** SHA-256 внутри ZIP проверены и совпали; SHA-256 зашифрованного архива: `9b9cf33eba5942c21b361bd3dad854b3314c3cf0a3f6912630aab67b8b84f7d0`.
- Исторический baseline: **17** записей миграционного журнала; 54 таблицы public, 54 RLS, 66 политик, 10 функций, 151 индекс, 5 пользователей Auth. Историческое восстановление и rollback от 29.10 задокументированы как PASS.
- Старый workflow 06.11 `KOL Live Backup Restore Rehearsal` (run `42186746800`) имеет **skipped** для собственно restore job; `KOL Persistent Migration Proof` (run `42186747104`) имеет **skipped** для real-source-proof. Успех этих workflow был успехом вспомогательных tooling/safety jobs, а не новой реставрации.
- Повторная расшифровка **не выполнена**: независимый ключ в разрешённом рабочем пространстве не предоставлен. Пакет не копировался в репозиторий и не передавался на внешние серверы. Дамп старше текущей версии; даже успешный restore даст только историческую проверку.
- При наличии локально переданного ключа допустим только offline decrypt → чистый одноразовый Supabase localhost:54322 → `rehearse-live-backup-restore.sh` → `qa-disposable-restored-migration-plan.mjs` (44 APPLY, VERIFY после каждого, 999 и роли). Никаких запросов к живой Supabase.

### Точный P0 разрыв одного E2E

1. `submitPublicIntakeRequest` создаёт `support_tickets` и сохраняет requestId; отдельный тест гарантирует оператору поддержку той же заявки под реальным JWT и аудит перехода статуса.
2. `adminSupportFormAction` ограничен `admin_support_lifecycle_atomic` (`reply` и `status`). `src/app/admin/orders/page.tsx` — страница чтения заказов. **Действия преобразования заявки в настоящий заказ с сохранённой связью ticket→order сейчас нет**.
3. Существующий `qa-local-partner-order-runtime.mjs` в режиме public intake явно создаёт **отдельные** заказы через клиентскую `create_order_atomic`, не из тикета. Партнёры A/B и статусные RPC проверяются с настоящими пользовательскими JWT, но это не один ticket ID.
4. `qa-local-partner-order-runtime.mjs` прямо требует, чтобы клиентский переключатель «Доставка — пока недоступна» был выключен, и создаёт только самовывоз. Существующий `qa-local-delivery-runtime.mjs` проверяет назначение и доставку на **отдельно подготовленном** заказе.
5. Следовательно, объединение отдельных зелёных сценариев в одно доказательство «заявка → оператор → партнёр → курьер» запрещено. Для этой цепочки нужны явно согласованные правила назначения исходной заявки клиенту/партнёру, атомарная конвертация с сохранением связи, подтверждённые цены/наличие, безопасное создание заказа доставки и права на операции. Оплату/отключённые модули не включать и фиктивную связь через QA INSERT не подменять бизнес-функцией.

### Матрица кабинетов (реальные JWT, одноразовая Supabase)

| Роль | Что уже доказано отдельными тестами | Дополнительная регрессия текущей ветки |
|---|---|---|
| CLIENT | Auth/RLS, бронирование и гонки, заказы и поддержка с правдой PostgreSQL | /client/orders, /client/bookings, /client/support без mock |
| ADMIN | Support lifecycle + audit, delivery assignment, catalog moderation | /admin/orders, /admin/bookings, /admin/support, /admin/delivery |
| PARTNER | Два разных партнёра, изоляция чужих заказов, переходы заказа, каталог, доступность | /partner/orders, /partner/bookings, /partner/availability |
| COURIER | Локальное JWT-принятие доставки, статусы, запись в history/audit | /courier/active, /courier/history |
| OWNER | Layout защищён `protectRoute("owner")`; разрешена только роль `super_admin` | Реальный GoTrue JWT `super_admin` видит сводку OWNER; CLIENT/PARTNER/COURIER должны быть отклонены |

Дополнительные проверки OWNER и всех 12 кабинетных read-маршрутов добавлены в `scripts/qa-local-supabase-auth-runtime.mjs`. Кабинетный тест не заменяет отдельные операционные E2E. `/client` также включён в production/mock 503-регрессию. Новые тесты считать **NOT VERIFIED**, пока их запуск на фактическом SHA не закончен SUCCESS.

**Текущий режим:** Draft PR #168, никакого merge/deploy. R2, рабочий Supabase, рабочая Ubuntu/Docker, Vercel, MARINA SMART, Аска Таш, AI PROF, n8n и реальные данные не менялись.

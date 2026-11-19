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

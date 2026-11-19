# KÖL — изолированный аудит безопасности и релизных блокеров, 2026-11-19

**Статус: DRAFT / NOT PRODUCTION READY / NO MERGE / NO DEPLOY.**

Исходная ветка: `release/kol-consolidated-gate-20261117`, HEAD при старте `7b8362f7b7caf460c0c02aa647746784fd2640f0`.
Рабочая ветка: `audit/kol-p0-hardening-isolated-20261119-gpt6`. От исходной истории не выполнялись rebase, merge, force-push, переименование или удаление.

## Границы

Изменяются только исходники и тесты в отдельной GitHub-ветке. Не используется живая Supabase, собственный сервер Ubuntu/Docker, Vercel, AI PROF, n8n, MARINA SMART, Аска Таш, рабочие данные. Не меняются `DATA_SOURCE_MODE`, `KOL_PRODUCTION_RUNTIME_READY`, не активируются AI/оплата/алкоголь/возвраты/выплаты. Действующий fail-closed production (HTTP 503) оставлен.

## Что подготовлено в коде, что проверено

| Пункт | Изменение в ветке | Фактическая проверка |
| --- | --- | --- |
| 1 | Черновик `supabase/schema/033_public_intake_atomic_rate_limit_DRAFT_NOT_APPLIED.sql` и `...VERIFY.sql`; атомарные IP + phone HMAC-лимиты с advisory locks, replay/conflict в одной транзакции; серверный action использует только RPC; доверенный заголовок окружения, ловушка и время заполнения; RU/KG/EN | Код подготовлен. SQL **не применён** к живой/общей БД. 10-way disposable CI тест подготовлен, его PASS **NOT VERIFIED** до нового CI. |
| 2 | `src/proxy.ts`: CSP Report-Only с Supabase/WebSocket, Google Fonts, самой сценой `/kol-stage/scene.html`; HSTS только production+HTTPS; сохраняется ранее установленный `frame-ancestors 'self'` у сцены | Браузерное подтверждение CSP **NOT VERIFIED**. |
| 3 | Статический AST-аудит всех экспортов `src/app/actions/**` в `check:release-source`. Точные разрешённые публичные Auth/Intake исключения и demo-only заглушки с контролем отсутствия реальной записи. `createStayBookingAction` дополнительно вызывает `requireClient()`. | Новый аудит CI **NOT VERIFIED**. Реально обнаруженный пробел: отсутствие проверки активной клиентской роли до RPC у `clientBookings.ts:createStayBookingAction`; исправлено в коде. Другие найденные дыры должны быть подтверждены запуском, никаких выдуманных результатов. |
| 4 | `scripts/qa-production-route-isolation.mjs`: локальный Next и HTTP 503 для `/admin`, `/owner`, `/partner`, `/courier` при обоих production-маркерах | Тест добавлен в `check:release-source`; результат **NOT VERIFIED**. |
| 5 | `scripts/qa-disposable-restored-migration-plan.mjs`: только подтверждённый localhost 54322 и восстановленная БД с 17 migration records; пошаговый APPLY+VERIFY, 999, `restored_role_isolation_TEST`; JSON-отчёт | **NOT VERIFIED**: входной подтверждённый restored-17 disposable baseline в этом рабочем сеансе отсутствует. Текущий `supabase/staging/migration-plan.json` содержит **44 шага**, а в задании указаны 42; не удаляем 2 шага без сверки. |
| 6 | Переиспользуются существующие изолированные `qa-local-supabase-auth-runtime.mjs`, partner/courier E2E тесты и `local-supabase-smoke` | Общая цепочка *клиент → заявка → оператор → партнёр → курьер*, два партнёра и реальные JWT на текущем исходном релизе **NOT VERIFIED**. Новые 028–032 из другого Draft PR не переносились вслепую. |
| 7 | Этот документ — единая актуальная точка статуса; старые документы не удалены | Документ сохранён в отдельной ветке. |
| 8 | `TabsTrigger`, `MobileNav`, мобильные переключатели языка: минимум 44 px. Новый Playwright `qa-mobile-tap-targets.mjs`: 320/375/390/430/1440 и RU/KG/EN, ошибка при маленьких интерактивных целях и горизонтальном переполнении | Скриншоты из ZIP-аудита исследованы. Новый Playwright PASS **NOT VERIFIED** до CI. |

### Безопасность и эксплуатационные условия

- `KOL_INTAKE_TRUSTED_IP_HEADER` обязателен; допустимые имена: `cf-connecting-ip`, `x-real-ip`, `x-forwarded-for`. Использовать можно **только заголовок, который доверенный edge-прокси удаляет из клиентского запроса и устанавливает заново**. Иначе атакующий сможет подставить чужой IP.
- HMAC IP/телефона создаётся с `KOL_INTAKE_IP_HMAC_KEY` либо резервным серверным service-role secret, сырой IP не хранится в заявке. Запрещено передавать секреты в клиентский код.
- Если источник IP, RPC, конфигурация или лимитер недоступны, новая заявка отклоняется (fail-closed). Поэтому внедрять код отдельно от DRAFT SQL нельзя: это намеренный предохранитель.
- `formStartedAt` приходит от браузера и **не считается доверенным доказательством**; поле-ловушка и задержка только уменьшают простой спам, основной антиобход обеспечивается транзакционной серверной блокировкой.
- CSP пока Report-Only. Перевод в enforcing запрещён до проверки реальных нарушений у сайта, сцены и кабинетов.
- В плановом локальном CI 033 разрешается применять только к вновь созданной одноразовой Supabase; это **не** утверждение применения к облачной базе.
- Публичный AI (#128), финансы, алкоголь и боевой запуск остаются выключенными.

### Доказательства / NOT VERIFIED

- **Проверено по GitHub на входе:** `release/kol-consolidated-gate-20261117` имела SHA `7b8362f7` с 11/11 завершёнными SUCCESS workflow. Это **только исходный SHA**, не новое изменение.
- **Код:** перечисленные файлы добавлены/обновлены в отдельной ветке; проверки нового HEAD ещё не были завершены на момент создания этого документа.
- **Браузер / disposable DB / E2E JWT:** NOT VERIFIED до соответствующих успешных CI job с точным новым SHA.
- **Живая Supabase, Vercel, Ubuntu, сервер Docker, коммерческая готовность:** NOT VERIFIED и намеренно не проверялись.
- Не следует приравнивать зелёный CI к Production GO.

### Ссылки на историю

- [Консолидация 2026-11-17](KOL_CONSOLIDATED_GATE_AUDIT_20261117.md).
- [Старый MVP и ограничения](KOL_MVP_SAFE_LAUNCH_2026-09-24.md).
- [Проверки заказа](KOL_ORDER_CORE_V2_2026-08-20.md).
- [Манифест изолированных миграций](../supabase/staging/migration-plan.json).
- [Legacy isolated restore rehearsal](../.github/workflows/live-backup-restore-rehearsal.yml).
- [Local Supabase CI](../.github/workflows/local-supabase-smoke.yml).

### До снятия Draft

1. Получить новый CI PASS на точном SHA, включая `npm run check:release-source`, browser/tap QA и 10-way disposable intake, исправив все фактические падения.
2. Получить подлинный restored-17 baseline **только внутри одноразового CI**, сверить 44 шага с историческим списком 42, выполнить VERIFY по каждому и postflight.
3. Подтвердить real-JWT цепочку с двумя партнёрами и отрицательными тестами, не переносить PR 166 без отдельного ревью.
4. Провести review заголовка IP на доверенном ingress и политики доступа к RPC; без этого публичные заявки намеренно недоступны.
5. Отдельно принять коммерческие данные и восстановление off-host. **Не запускать production** автоматически.

# KÖL Travel Platform

KÖL — единая туристическая платформа Иссык-Куля: публичная витрина, проживание, туры, еда и магазин, а также кабинеты клиента, партнёра, курьера, администратора и собственника.

## Текущий технический контур

- Next.js 16.3.1, React 19.2.x, TypeScript, Tailwind CSS.
- Node.js 22+; CI и browser QA выполняются на Node.js 24.
- Supabase предусмотрен как production data/auth backend, но production runtime намеренно остаётся fail-closed до прохождения всех release gates.
- Mock-данные допустимы только для локального/preview UI и source smoke. Они не являются доказательством production-данных.
- `ALCOHOL_MODULE_ENABLED=false` — алкогольный модуль не активирован.
- Финансовые значения, комиссии, выплаты и возвраты не должны вычисляться или имитироваться без подтверждённого финансового ledger и утверждённых бизнес-правил.

## Статус на 29 августа 2026

Исходный код восстановлен и работает на канонической ветке `main`. Аудированный baseline после security/QA repair: `aaefc69c4e3b63876c4c92c7a8c1602eb30c726e`. Основные role/read paths, публичные каталоги, booking/order safety, finance fail-closed и release checks покрыты repository-native CI/QA.

Production **не считается разрешённым** только потому, что приложение собирается или существует Vercel deployment. В коде действует двойной production gate:

1. source gate `PRODUCTION_RUNTIME_IMPLEMENTATION_READY`;
2. runtime gate `KOL_PRODUCTION_RUNTIME_READY=true`.

До отдельного подтверждённого production cutover оба условия не должны обходиться переменными окружения.

### Подтверждённые внешние ограничения

- Supabase-проект KÖL должен быть отдельно проверен/восстановлен перед реальным staging/production UAT; его состояние нельзя подменять mock-данными.
- Платёжный провайдер, комиссии, payout/refund/no-show правила требуют авторитетного бизнес-решения до активации финансового контура.
- Production secrets/config, backup/restore evidence, staging E2E и финальное production approval остаются отдельными gates.
- Исторические Vercel preview/freeze deployments не являются доказательством текущего `main`.

## Основные маршруты

### Public

- `/` — главная
- `/stays` — проживание
- `/tours` — туры
- `/food` — рестораны/еда
- `/shop` — магазин
- `/cart`, `/checkout`, `/booking/checkout` — клиентские сценарии оформления
- `/contacts`, `/partners`, `/photo-credits`

### Role workspaces

- `/client`
- `/partner`
- `/courier`
- `/admin`
- `/owner`
- `/team` — безопасная точка входа/preview ролей; preview не объединяет реальные полномочия ролей.

## Проверка проекта

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm run check:release-source
```

Дополнительные browser/public-flow проверки запускаются GitHub Actions workflows `KOL CI`, `KOL Public Flows` и `KOL Visual QA`.

## Environment contract

Скопируйте `.env.example` только как шаблон. Реальные секреты не коммитятся.

Ключевые safety-переменные:

```env
DATA_SOURCE_MODE=mock
KOL_DEPLOYMENT_ENV=development
KOL_PRODUCTION_RUNTIME_READY=false
ALCOHOL_MODULE_ENABLED=false
```

На Vercel платформенный `VERCEL_ENV=production` должен считаться авторитетным признаком production и не может быть понижен ручным `KOL_DEPLOYMENT_ENV`.

## Правила разработки

- `main` — канонический источник текущего кода.
- Изменения делаются через scoped branch/PR и проверяются CI на exact head.
- Не считать demo/mock/preview evidence production evidence.
- Не активировать production, Supabase mutations, платежи, secrets или destructive operations без соответствующего gate/approval.
- Не ослаблять Auth/RBAC/RLS ради прохождения UI или тестов.
- При отсутствии авторитетных данных — fail closed, а не выдумывать значения.

## Где смотреть актуальную готовность

- GitHub issue `#16` — текущие P0 owner/production gates.
- `.github/workflows/` — обязательные CI/QA gates.
- `src/lib/deployment-safety.ts` и `scripts/check-deployment-env.mjs` — production fail-closed contract.
- `supabase/` — schema/staging package; наличие файлов не означает, что migrations применены в production.

Этот README описывает **текущий архитектурный статус**, а не исторический roadmap. Датированные audit/implementation документы в `docs/` следует читать как evidence конкретного этапа, а не автоматически как текущую истину.
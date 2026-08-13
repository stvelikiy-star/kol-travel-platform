# TECH STACK

## Назначение

Документ описывает рекомендуемый технический стек KÖL / Issyk-Kul Travel & Delivery Platform. На Stage 01D это только рекомендация и архитектурная фиксация: сайт, UI, backend, Supabase, платежи, Telegram и n8n не подключаются.

## Next.js

Зачем нужен: основной web framework для публичного сайта, кабинетов и будущих API route handlers.

Где используется: public catalog, client cabinet, partner cabinet, admin panel, future API.

MVP-вариант: Next.js app с server components и route handlers позже.

Future-вариант: production app с кешированием, middleware, role-based routing.

Риски: преждевременное усложнение, если начать с UI до завершения specs.

## TypeScript

Зачем нужен: типизация сущностей, API contracts, статусов, ролей.

Где используется: frontend, backend, shared types, validation.

MVP-вариант: строгие типы для моделей и API responses.

Future-вариант: generated types из Supabase/PostgreSQL.

Риски: типы должны синхронизироваться со схемой БД.

## Tailwind CSS

Зачем нужен: быстрый и единый styling system.

Где используется: публичный интерфейс, кабинеты, админка.

MVP-вариант: дизайн-система с токенами, spacing, typography, states.

Future-вариант: полноценный component library.

Риски: хаотичные классы без design system.

## Supabase / PostgreSQL

Зачем нужен: база данных, auth/storage опции, future RLS.

Где используется: Users, partners, catalog, orders, bookings, payments, logs.

MVP-вариант: PostgreSQL schema по `DATABASE_SCHEMA.md`, RLS позже.

Future-вариант: Supabase RLS, realtime where useful, generated types.

Риски: неверные RLS policies, service role leakage, миграции без review.

## Supabase Auth или NextAuth/Auth.js

Зачем нужен: аутентификация и роли.

Где используется: client, partner, admin, courier, support, finance.

MVP-вариант: выбрать один auth-подход после утверждения API и schema.

Future-вариант: RBAC, session hardening, audit logs.

Риски: смешивание двух auth-систем без ясной причины.

## Supabase Storage или Cloudinary

Зачем нужен: хранение фото партнёров, номеров, блюд, товаров, туров, документов.

Где используется: catalog media, partner docs, review photos.

MVP-вариант: один storage provider, ограниченные upload rules.

Future-вариант: CDN, image transforms, moderation pipeline.

Риски: хранение чувствительных документов без доступа и lifecycle policy.

## n8n

Зачем нужен: автоматизации уведомлений, операционных flow, интеграций.

Где используется: future notifications, admin workflows, partner reminders.

MVP-вариант: не подключать на текущем этапе.

Future-вариант: webhook workflows, retries, audit.

Риски: бизнес-логика может размазаться между app и n8n.

## Telegram Bot

Зачем нужен: уведомления клиентам, партнёрам и оператору.

Где используется: order/booking status, support, partner alerts.

MVP-вариант: не подключать на Stage 01D.

Future-вариант: bot with verified chat IDs, templates, retries.

Риски: доставка уведомлений не должна быть источником правды для статусов.

## Google Sheets для MVP

Зачем нужен: быстрый операционный учёт на раннем этапе.

Где используется: partner onboarding, manual content collection, early finance reconciliation.

MVP-вариант: таблицы как temporary back-office tool.

Future-вариант: импорт в admin panel и database.

Риски: дублирование источников правды, ручные ошибки, доступы.

## 2GIS / Google Maps

Зачем нужен: геолокация, адреса, зоны доставки, точки партнёров.

Где используется: catalog, delivery zones, stays, tours, restaurants, shops.

MVP-вариант: выбрать provider после проверки покрытия Иссык-Куля.

Future-вариант: geocoding, routing, delivery ETA.

Риски: стоимость API, качество адресов, offline/seasonal локации.

## Payments Later

Зачем нужен: будущие online payments, предоплаты, refunds, payouts.

Где используется: orders, bookings, partner payouts, finance.

MVP-вариант: manual / cash / transfer / COD records only.

Future-вариант: acquiring, wallets, payment links, refunds.

Риски: юридические договоры, комиссии, chargebacks, reconciliation.

## Vercel Deployment

Зачем нужен: хостинг Next.js, preview deployments, production build.

Где используется: public app, cabinets, admin later.

MVP-вариант: deploy after implementation stages.

Future-вариант: production domains, environment separation, monitoring.

Риски: env leaks, vendor lock-in, сезонная нагрузка.

## Почему не делать MVP на обычном лендинге

KÖL — не витрина и не одностраничный сайт. Платформа включает marketplace, роли, кабинеты, заказы, бронирования, stop-кнопку, календарь доступности, поддержку, финансы, промокоды, баллы и будущие интеграции. Лендинг не проверит главные риски продукта: актуальность доступности, партнёрскую CRM, checkout, booking flow, статусы и операционную поддержку.

## Почему сначала mock/manual payment, а online payments позже

Manual payment снижает юридический и технический риск на раннем этапе. До online payments нужно уточнить договоры, провайдера, комиссии, возвраты, фискальные требования, правила предоплат и partner payouts. MVP может фиксировать `manual`, `cash`, `transfer`, `cod` статусы, а online acquiring подключать после юридической и финансовой проработки.

## Stage 01D Решение

Текущий этап остаётся документационным. Инструменты перечислены как рекомендованный стек, но не подключаются.

# DATA ACCESS LAYER PLAN

## Назначение

Документ описывает слой доступа к данным для KÖL / Issyk-Kul Travel & Delivery Platform. Stage 11D готовит безопасный переход от mock data к будущему Supabase backend без подключения реальной базы.

## Текущий режим

Current mode: `mock`.

Файл `src/lib/data/data-source.ts` задаёт режим:

- `getDataSourceMode()`;
- `isMockDataMode()`;
- `isSupabaseMode()`.

По умолчанию всегда используется mock mode. Если env vars отсутствуют, приложение не падает.

## Зачем нужен data layer

Data access layer нужен, чтобы:

- не импортировать mock data напрямую во всех будущих страницах;
- сохранить текущий UI стабильным;
- позже заменить internals на Supabase queries;
- мигрировать страницы постепенно;
- держать business rules ближе к data access;
- не ломать public/client/partner/courier/admin dashboards при переходе.

## Созданные модули

### `src/lib/data/mock-data-source.ts`

Центральный доступ к текущим mock-файлам:

- `getMockOrders()`;
- `getMockBookings()`;
- `getMockTours()`;
- `getMockStays()`;
- `getMockFood()`;
- `getMockProducts()`;
- `getMockPartners()`.

### `src/lib/data/orders.ts`

Функции для заказов:

- `getOrders()`;
- `getOrderById(id)`;
- `getClientOrders(clientId?)`;
- `getPartnerOrders(partnerId?)`;
- `getDeliveryOrders()`.

### `src/lib/data/bookings.ts`

Функции для броней:

- `getBookings()`;
- `getBookingById(id)`;
- `getClientBookings(clientId?)`;
- `getPartnerBookings(partnerId?)`.

### `src/lib/data/catalog.ts`

Функции для публичного каталога:

- `getTours()`;
- `getTourById(idOrSlug)`;
- `getStays()`;
- `getStayById(idOrSlug)`;
- `getFood()`;
- `getFoodById(idOrSlug)`;
- `getProducts()`;
- `getProductById(idOrSlug)`.

### `src/lib/data/partners.ts`

Функции для партнёров:

- `getPartners()`;
- `getPartnerById(id)`;
- `getPartnerBySlug(slug)`.

### `src/lib/data/delivery.ts`

Функции для доставки:

- `getDeliveries()`;
- `getDeliveryByOrderId(orderId)`;
- `getCourierDeliveries(courierId?)`;
- `getDeliveryRiskLevel(order)`.

Delivery statuses normalized for future:

- `delivery_pending`;
- `courier_assigned`;
- `courier_accepted`;
- `courier_to_partner`;
- `picked_up`;
- `courier_to_client`;
- `delivered`;
- `delivery_failed`.

### `src/lib/data/admin.ts`

Функции для admin dashboard:

- `getAdminDashboardData()`;
- `getAdminOrders()`;
- `getAdminBookings()`;
- `getAdminDeliveryRisks()`;
- `getAIRecommendationsDemo()`.

## Future Supabase mode

В будущем Supabase mode должен заменить только внутренности функций:

- mock imports заменяются на Supabase queries;
- public catalog получает published/active rows;
- client functions получают rows по текущему user id;
- partner functions получают rows по `business_id`;
- courier functions получают assigned deliveries;
- admin functions получают агрегаты по admin role.

Публичный API функций должен оставаться стабильным, чтобы страницы не переписывались повторно.

## Page-by-page migration plan

Миграция должна идти постепенно:

1. Public catalog pages.
2. Public detail pages.
3. Cart/checkout validation layer.
4. Client cabinet.
5. Partner cabinet.
6. Courier cabinet.
7. Admin panel.
8. AI dispatcher and notifications.

На каждом шаге:

- заменить прямой import из `src/data/*` на `src/lib/data/*`;
- проверить build;
- проверить route visually;
- сохранить fallback/mock mode;
- не включать real mutations до готовности RLS.

## Safety rules

- Real Supabase is not connected yet.
- No real auth is enabled.
- No payments are enabled.
- Telegram/n8n are not connected.
- Mock data remains available.
- Pages are not mass-refactored in Stage 11D.
- Missing env vars must not crash app.

## Alcohol compliance

Alcohol module remains OFF by default.

No alcohol delivery or sales are enabled.

`canEnableAlcoholModule()` remains false in the auth helper layer.

Future activation requires:

- legal review;
- licensing;
- partner verification;
- age gate and age check;
- admin approval;
- audit log;
- explicit feature flag change.

## Next step

Stage 11E — Page-by-Page Data Layer Migration.

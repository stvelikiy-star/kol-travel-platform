# AUTH AND ROLES PLAN

## Назначение

Документ описывает план авторизации и ролей для KÖL / Issyk-Kul Travel & Delivery Platform. На этом этапе auth не подключается, Supabase/Auth.js/Firebase packages не добавляются, реальные сессии не создаются.

## Compliance note

Alcohol module remains OFF by default. No alcohol delivery or sales are enabled. Activation requires legal review, licensing, partner verification and admin approval. `ALCOHOL_MODULE_ENABLED=false`.

## Auth principles

- Один пользователь может иметь несколько ролей, но действия всегда выполняются в выбранном role scope.
- Partner scope всегда ограничен конкретным `business_id`.
- Courier scope ограничен собственным профилем, сменами и назначенными доставками.
- Admin роли должны быть разделены по отделам: support, finance, moderation, super admin.
- Все sensitive actions требуют audit log.
- High-risk AI recommendations требуют human/admin approval.

## Роли

### guest

Login access: не требуется.

Dashboard access: нет.

Can view:
- public homepage;
- public catalog;
- detail pages;
- contacts/partners info.

Can edit:
- ничего в базе;
- временная UI-корзина до auth возможна только как local/session state.

Cannot do:
- оформить реальный заказ/бронь без client identity;
- видеть кабинеты;
- видеть персональные цены, баллы, уведомления.

Sensitive actions: нет.

### client

Login access: email/phone/social provider later.

Dashboard access: `/client`.

Can view:
- only own profile;
- own orders;
- own bookings;
- own loyalty balance;
- own favorites;
- own notifications;
- own support tickets.

Can edit:
- own profile fields;
- delivery addresses;
- support tickets;
- review own completed orders/bookings;
- create orders/bookings after validation.

Cannot do:
- see other clients;
- see partner finance;
- change order status after partner/courier stages except allowed cancel flow;
- access admin/partner/courier dashboards.

Sensitive actions requiring admin approval:
- disputed refund;
- late booking cancellation exceptions;
- delivery complaint escalation.

### partner_owner

Login access: required.

Dashboard access: `/partner` for own business.

Can view:
- own business profile;
- own staff;
- own catalog;
- own orders/bookings;
- own reviews;
- own analytics;
- own payouts summary.

Can edit:
- business settings;
- staff permissions;
- catalog items;
- availability;
- stop-button scopes;
- partner CRM statuses allowed by flow.

Cannot do:
- see other partner data;
- change platform commissions;
- change payment status directly;
- close courier delivery;
- enable alcohol module.

Sensitive actions:
- cancel accepted booking;
- request refund;
- suspend business;
- add alcohol products, only after compliance approval.

### partner_manager

Login access: required.

Dashboard access: `/partner` for assigned business.

Can view:
- business operations;
- orders/bookings;
- availability;
- catalog.

Can edit:
- orders/bookings statuses allowed by permissions;
- availability;
- menu/products/tours/rooms if allowed.

Cannot do:
- manage owner permissions;
- see finance unless granted;
- change legal/compliance settings.

Sensitive actions:
- mass stop/pause;
- cancellation of confirmed booking;
- payout-related requests.

### partner_staff

Login access: required.

Dashboard access: limited partner workspace.

Can view:
- assigned operational sections.

Can edit:
- preparation status;
- ready-for-pickup;
- limited stock/status updates.

Cannot do:
- finance;
- staff management;
- business settings;
- global stop_business unless explicitly allowed.

Sensitive actions:
- reject order;
- report serious issue.

### courier

Login access: required.

Dashboard access: `/courier`.

Can view:
- own courier profile;
- assigned deliveries;
- pickup/dropoff details for assigned delivery;
- own earnings demo/future payouts.

Can edit:
- own availability status;
- physical delivery statuses;
- delivery issue reports.

Cannot do:
- see unrelated deliveries;
- see platform finance;
- change payment status;
- change order contents;
- cancel order without admin;
- enable alcohol delivery.

Sensitive actions:
- delivery_failed;
- client_not_available;
- cash/payment problem escalation.

### dispatcher

Login access: required.

Dashboard access: delivery/admin operations scope.

Can view:
- active deliveries;
- courier availability;
- delivery issues;
- AI recommendations.

Can edit:
- courier assignments if policy allows;
- escalation status;
- internal delivery notes.

Cannot do:
- change payment status;
- approve refunds;
- change partner catalog;
- enable alcohol module.

Sensitive actions:
- forced reassignment;
- delivery cancellation request;
- critical escalation.

### support_admin

Login access: required.

Dashboard access: admin support scope.

Can view:
- support tickets;
- related order/booking summary;
- limited client/partner contact data.

Can edit:
- ticket messages;
- ticket statuses;
- escalation labels.

Cannot do:
- change finance records;
- change user roles;
- change payment status;
- modify catalog without moderation role.

Sensitive actions:
- refund escalation;
- privacy-sensitive data access;
- dispute resolution recommendation.

### finance_admin

Login access: required.

Dashboard access: `/admin/finance`.

Can view:
- payments;
- payouts;
- commissions;
- refunds;
- finance reports.

Can edit:
- payout preparation;
- refund workflow status;
- finance reconciliation notes.

Cannot do:
- change catalog;
- assign couriers;
- change non-finance user roles;
- bypass audit logs.

Sensitive actions:
- refund approval;
- payout approval;
- commission changes;
- manual transaction correction.

### super_admin

Login access: required with strongest auth requirements.

Dashboard access: full admin panel.

Can view:
- all platform data;
- audit logs;
- compliance records;
- AI dispatcher logs.

Can edit:
- roles;
- platform settings;
- moderation statuses;
- emergency operational states.

Cannot do:
- bypass legal requirements;
- enable alcohol module without legal review/licensing/partner verification/admin approval chain.

Sensitive actions:
- role grants;
- alcohol module activation;
- payment/refund overrides;
- accepted order/booking cancellation;
- deletion/archival of critical records.

## AI actor

AI is not a human role. It may receive limited service identity for writing:
- `ai_dispatcher_events`;
- `ai_recommendations`;
- `ai_alerts`;
- `ai_decision_logs`.

AI cannot directly:
- cancel orders;
- change payment status;
- promise delivery time without data;
- enable alcohol delivery;
- approve refunds;
- perform high-risk actions without human approval.

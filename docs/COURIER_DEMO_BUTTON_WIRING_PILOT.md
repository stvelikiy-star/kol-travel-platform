# Courier Demo Button Wiring Pilot

Stage: 12G-5 - Courier Demo Button Wiring Pilot.

This pilot connects a small set of courier UI buttons to safe demo action skeletons. It is demo-only wiring: no real backend is connected, no Supabase writes are used, mock data is not mutated, and no payments, Telegram or n8n flows are involved.

`ALCOHOL_MODULE_ENABLED=false` remains visible through `DemoActionResultPanel`. Alcohol module is disabled.

## Connected Pages

### `/courier/active`

The active delivery page now renders `CourierActiveDemoActions`, a small client component for demo interactions only.

Connected buttons:

- `Еду к партнёру` -> `markCourierToPartnerDemoAction`;
- `Забрал заказ` -> `markPickedUpDemoAction`;
- `Еду к клиенту` -> `markCourierToClientDemoAction`;
- `Доставлено` -> `markDeliveredDemoAction`.

The pilot uses placeholder ID `demo-delivery-1`.

### `/courier/issues`

The courier issues page now renders `CourierIssueDemoActions`, a small client component for demo issue reporting only.

Connected buttons:

- `Партнёр не готов` -> `reportPartnerNotReadyDemoAction`;
- `Клиент не отвечает` -> `reportClientNotAnsweringDemoAction`;
- `Проблема с адресом` -> `reportAddressProblemDemoAction`;
- `Нужен админ` -> `requestAdminSupportDemoAction`.

The pilot uses placeholder ID `demo-courier-issue-1` and placeholder reasons:

- `Demo courier issue`;
- `Demo reason from courier cabinet`.

## Result Panel Behavior

After a pilot button click, the page displays `DemoActionResultPanel` with:

- demo mode label;
- action message;
- action name;
- role;
- risk level;
- audit warning when `auditRequired=true`;
- human approval warning when `humanApprovalRequired=true`;
- alcohol safety line.

The panel must not claim that real data was changed.

## High-Risk Warning Behavior

Courier issue actions with high risk show audit warnings through the result panel. `requestAdminSupportDemoAction` also shows the human approval warning because high-risk admin support requires human review later.

This pilot does not add a toast library and does not add dependencies.

## Safety Rules

Courier demo actions cannot:

- change payment status;
- change order items;
- cancel orders;
- approve refunds;
- enable alcohol module.

AI/admin escalation remains future work. Any real delivery status write must wait for auth, role checks, ownership checks, RLS, audit logs and approval workflows.

## Next Recommended Wiring Stages

Recommended next stages:

- connect a small admin delivery demo button pilot;
- connect AI dispatcher recommendation demo buttons;
- add shared warning copy for high/critical actions before real backend wiring;
- keep all demo actions isolated from real writes until Supabase auth, RLS and audit logs are ready.

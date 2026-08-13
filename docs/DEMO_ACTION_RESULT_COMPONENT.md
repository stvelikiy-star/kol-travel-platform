# Demo Action Result Component

Stage: 12G-3 - Shared Demo Result UI Component.

`src/components/shared/DemoActionResultPanel.tsx` is a shared presentation component for displaying safe demo action results later in partner, courier, admin and AI dispatcher flows.

The component is demo-mode only. It does not import server actions, does not call Supabase, does not mutate data, does not require environment variables, and is not connected to any UI buttons yet.

## Purpose

The component gives future demo action wiring a consistent visual result panel:

- demo mode label;
- action result message;
- action name;
- optional role;
- optional risk level;
- audit warning when `auditRequired=true`;
- human approval warning when `humanApprovalRequired=true`;
- alcohol safety line.

## Risk Display

Supported risk levels:

- `low`: calm success/info tone for routine demo actions;
- `medium`: attention tone for actions that need later validation;
- `high`: warning tone for actions that require audit or approval messaging;
- `critical`: critical warning tone for payment, refund, cancellation, safety, legal or alcohol compliance risks.

High and critical actions must not be wired as silent button clicks later. They should show clear warning copy before real backend integration.

## Audit Warning

When a result has `auditRequired=true`, the panel shows:

`В реальной версии будет запись в журнале аудита.`

Future real actions must write audit logs only after auth, role validation, ownership/RLS checks and approval rules are implemented.

## Human Approval Warning

When a result has `humanApprovalRequired=true`, the panel shows:

`В реальной версии требуется подтверждение админа.`

This is required later for high-risk operations such as accepted order cancellation, confirmed booking cancellation, refunds, payment status changes, delivery overrides, emergency stops and critical AI recommendations.

## Alcohol Module Disabled

The panel always shows:

`ALCOHOL_MODULE_ENABLED=false. Alcohol module disabled.`

Alcohol sales and delivery remain disabled. AI, partner, courier and admin demo actions cannot enable alcohol module. Any future alcohol activation requires legal review, licensing, partner verification and `super_admin` approval.

## Future Usage

Future stages may render this panel after demo button clicks in:

- partner order, booking, stop, catalog and availability pages;
- courier delivery, issue and profile pages;
- admin delivery, moderation, finance and users pages;
- AI dispatcher recommendation, alert and decision-log pages.

Before connecting it to any button, the project should keep actions demo-only and avoid real writes until backend, auth, RLS, audit logs and approval workflows are ready.

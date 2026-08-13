# Partner Stop Button Rules

Stage: 12E-INTERNAL-5A — Partner Stop Button UX Only.

This document defines the demo UX and future operational rules for the partner stop button. No backend, Supabase writes, payments, Telegram/n8n, or real actions are connected.

`ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## Stop Button Scope

The stop button is a partner-facing operational control for pausing or limiting future demand. It can target:

- full business temporarily;
- future orders;
- future bookings;
- one item;
- one category;
- one date;
- one time slot;
- delivery availability;
- booking availability.

Each stop action should eventually include:

- selected scope;
- reason for stop;
- planned resume time;
- actor user;
- partner ID;
- status before and after;
- audit log for sensitive cases.

## What Stop Button Can Do

Stop button can:

- pause future orders;
- pause future bookings;
- stop one item;
- stop one category;
- stop one date;
- stop one time slot;
- stop full business temporarily;
- add reason for stop;
- show planned resume time.

These actions are demo-only in the current UI. Real implementation must validate auth, partner ownership, role permissions, RLS, and audit requirements.

## What Stop Button Cannot Do

Stop button cannot:

- cancel accepted orders;
- cancel confirmed bookings;
- cancel delivery in progress;
- change payment status;
- force refund;
- remove audit requirements;
- enable alcohol module.

Accepted orders and confirmed bookings remain protected. Delivery in progress remains controlled by the courier, AI dispatcher, and KOL admin.

## Accepted Orders And Bookings Protection

Stopping future demand never cancels already accepted work.

Protected items:

- accepted food/shop orders;
- orders already marked `ready_for_pickup`;
- orders picked up by courier;
- confirmed bookings;
- accepted tour bookings;
- accepted room bookings.

If a partner needs to cancel or modify protected work, the partner must report the issue and request admin support.

## Admin Escalation Cases

Admin is required for:

- accepted order cancellation;
- confirmed booking cancellation;
- refund request;
- payment issue;
- full business emergency stop;
- suspicious behavior;
- legal/compliance issue;
- alcohol-related request.

Future implementation must require human/admin approval for high-risk cases, store a reason, and create an audit log.

## AI Limitations

AI dispatcher can:

- recommend pause;
- detect overload;
- alert admin;
- draft message.

AI dispatcher cannot:

- cancel accepted orders;
- change payment status;
- approve refund;
- remove audit requirements;
- enable alcohol module.

AI recommendations are not approvals. High-risk actions require human admin approval.

## Alcohol Module Disabled

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- AI cannot enable alcohol module.
- Stop button cannot enable alcohol module.
- Any future alcohol activation requires legal review, licensing, partner verification, and `super_admin` approval.
- Any alcohol-related request is critical risk.

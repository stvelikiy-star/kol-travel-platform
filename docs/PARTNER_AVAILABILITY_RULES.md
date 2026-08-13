# Partner Availability Rules

Stage: 12E-INTERNAL-5B — Partner Availability UX Only.

This document describes partner availability demo UX and future backend rules. No backend, Supabase writes, payments, Telegram/n8n, or real actions are connected.

`ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## Availability Controls By Category

Partner availability controls affect future demand only. They do not cancel accepted orders or confirmed bookings.

### Stays And Rooms

Demo controls:

- room available / unavailable;
- date blocked;
- booking conflict warning;
- minimum nights later;
- close date demo;
- open date demo.

Rules:

- blocked room date prevents only new bookings;
- confirmed booking cannot be cancelled without admin;
- overbooking prevention will be handled by backend later;
- RoomAvailability must be checked during booking checkout.

### Tours

Demo controls:

- date available / unavailable;
- seats available;
- time slot blocked;
- weather/manual stop note;
- close tour date demo;
- limit seats demo.

Rules:

- blocked tour date prevents only new tour bookings;
- confirmed tour booking cancellation requires admin;
- minimum and maximum guests will be controlled later;
- TourSchedule must be checked during booking checkout.

### Food And Menu

Demo controls:

- item available / unavailable;
- kitchen overloaded;
- delivery temporarily paused;
- preparation time changed later;
- stop one menu item demo.

Rules:

- stopped dish hides only from new orders;
- partner can pause delivery/preparation for future orders;
- accepted food order cannot be cancelled without admin;
- preparation time and kitchen load will be connected later.

### Products

Demo controls:

- in stock / out of stock;
- low stock;
- stop one product;
- stop category;
- stock reservation later.

Rules:

- stopped product blocks only new orders;
- accepted product order cannot be cancelled without admin;
- real stock will be connected later;
- checkout must re-check stock before order creation.

## Accepted Orders And Bookings Protection

Availability changes protect already accepted work:

- accepted orders remain active;
- confirmed bookings remain active;
- delivery in progress is not cancelled by availability changes;
- payment status is not changed;
- refund is not forced;
- audit requirements remain.

Partner must request admin support for accepted order cancellation, confirmed booking cancellation, refund requests, payment issues, legal/compliance cases, or emergency incidents.

## Admin Escalation Cases

Admin is required for:

- accepted order cancellation;
- confirmed booking cancellation;
- payment status change;
- refund request;
- suspicious partner or client behavior;
- emergency stop that affects accepted work;
- legal/compliance issue;
- alcohol-related request.

Future implementation must require human approval, reason, risk level, and audit log for high-risk cases.

## AI Limitations

AI dispatcher can:

- recommend pause;
- detect overload;
- detect availability conflict;
- alert admin;
- draft message.

AI dispatcher cannot:

- cancel accepted orders or confirmed bookings;
- change payment status;
- approve refund;
- force availability override;
- enable alcohol module.

AI recommendations are not approvals. High-risk actions require human admin approval.

## Future Backend Actions

Future write actions may update:

- `room_availability`;
- `tour_schedules`;
- menu item availability;
- product stock and product status;
- partner stop scope records;
- audit logs;
- notifications.

Before real actions are enabled, backend must validate auth, role, partner ownership, RLS, conflict checks, and audit log requirements.

## Alcohol Module Disabled

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- AI cannot enable alcohol module.
- Partner availability controls cannot enable alcohol module.
- Any future alcohol activation requires legal review, licensing, partner verification, and `super_admin` approval.
- Any alcohol-related request is critical risk.

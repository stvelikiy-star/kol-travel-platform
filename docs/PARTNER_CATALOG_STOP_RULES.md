# Partner Catalog Stop Rules

Stage: 12E-INTERNAL-5C — Partner Catalog Stop UX Only.

This document describes partner catalog stop/status UX and future backend rules. No backend, Supabase writes, payments, Telegram/n8n, or real actions are connected.

`ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## Catalog Stop Controls By Category

Catalog stop controls affect future sales and future bookings only. They do not delete catalog records and do not cancel accepted work.

### Tours

Demo controls:

- tour active / paused;
- stop tour date;
- stop tour time slot;
- seats unavailable;
- reason for stop;
- planned resume time.

Rules:

- stopping a tour blocks only new tour bookings;
- confirmed tour bookings require admin to cancel;
- seats and schedules must be checked again during booking checkout later.

### Stays And Rooms

Demo controls:

- room active / paused;
- stop room type;
- block dates;
- booking conflict;
- reason for stop;
- planned resume time.

Rules:

- stopping a room blocks only new stay bookings;
- confirmed stay bookings require admin to cancel;
- RoomAvailability and booking conflicts must be checked by backend later.

### Food And Menu

Demo controls:

- dish active / paused;
- out of stock;
- kitchen overloaded;
- prep time notice later;
- reason for stop;
- planned resume time.

Rules:

- stopping a dish blocks only new food orders;
- accepted food orders require admin to cancel;
- kitchen overload can trigger pause recommendations and admin alerts.

### Products

Demo controls:

- product active / paused;
- out of stock;
- low stock;
- stop product category;
- reason for stop;
- planned resume time.

Rules:

- stopping a product blocks only new product orders;
- accepted product orders require admin to cancel;
- stock reservation and checkout re-checks will be connected later.

## Accepted Orders And Bookings Protection

Protected work:

- accepted food orders;
- accepted product orders;
- confirmed tour bookings;
- confirmed stay bookings;
- delivery in progress.

Catalog stop does not:

- cancel accepted orders;
- cancel confirmed bookings;
- change payment status;
- force refund;
- remove audit requirements;
- delete catalog items.

If cancellation or refund is required, partner must request admin escalation.

## Admin Escalation Cases

Admin is required for:

- accepted order cancellation;
- confirmed booking cancellation;
- payment status change;
- refund request;
- legal/compliance issue;
- suspicious partner/client behavior;
- alcohol-related request.

Future implementation must require role validation, ownership validation, reason, risk level, human approval for high-risk cases, and audit log.

## AI Limitations

AI can:

- recommend pausing a position;
- detect overload or stock issue;
- alert admin;
- draft customer/partner message.

AI cannot:

- cancel accepted orders or confirmed bookings;
- change payment status;
- approve refund;
- enable alcohol module.

AI recommendations are not approvals. High-risk actions require human admin approval.

## Future Backend Actions

Future implementation may write to:

- catalog item status;
- product stock status;
- menu item availability;
- tour schedule availability;
- room availability;
- partner stop scope records;
- audit logs;
- notifications.

Before enabling writes, backend must validate auth, role, partner ownership, RLS, conflict checks, and audit requirements.

## Alcohol Module Disabled

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- AI cannot enable alcohol module.
- Catalog stop/status UX cannot enable alcohol module.
- Any future alcohol activation requires legal review, licensing, partner verification, and `super_admin` approval.
- Any alcohol-related request is critical risk.

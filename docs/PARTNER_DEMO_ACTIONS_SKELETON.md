# Partner Demo Actions Skeleton

Stage: 12F-2 — Partner Demo Actions Skeleton.

This document describes safe demo skeleton actions for partner internal operations. These actions do not write to Supabase, do not mutate mock data, do not require environment variables, and are not connected to UI yet.

`ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## Created Partner Demo Actions

Partner order actions:

- `acceptPartnerOrderDemoAction(orderId)`;
- `rejectPartnerOrderDemoAction(orderId, reason)`;
- `markOrderPreparingDemoAction(orderId)`;
- `markOrderReadyForPickupDemoAction(orderId)`;
- `reportPartnerOrderIssueDemoAction(orderId, reason)`;
- `requestAcceptedOrderCancellationDemoAction(orderId, reason)`.

Partner booking actions:

- `confirmPartnerBookingDemoAction(bookingId)`;
- `rejectPartnerBookingDemoAction(bookingId, reason)`;
- `markGuestArrivedDemoAction(bookingId)`;
- `reportPartnerBookingIssueDemoAction(bookingId, reason)`;
- `requestConfirmedBookingCancellationDemoAction(bookingId, reason)`.

Partner stop actions:

- `pauseFutureOrdersDemoAction(reason, plannedResumeTime?)`;
- `pauseFutureBookingsDemoAction(reason, plannedResumeTime?)`;
- `pauseFullBusinessDemoAction(reason, plannedResumeTime?)`;
- `resumeBusinessDemoAction(reason)`;
- `emergencyStopRequestDemoAction(reason)`.

Partner catalog actions:

- `pauseCatalogItemDemoAction(itemId, reason)`;
- `resumeCatalogItemDemoAction(itemId)`;
- `markCatalogItemOutOfStockDemoAction(itemId, reason)`;
- `pauseCatalogCategoryDemoAction(categoryId, reason)`;
- `reportCatalogIssueDemoAction(itemId, reason)`.

Partner availability actions:

- `blockAvailabilityDateDemoAction(scopeId, date, reason)`;
- `unblockAvailabilityDateDemoAction(scopeId, date)`;
- `blockAvailabilitySlotDemoAction(scopeId, slot, reason)`;
- `updateAvailabilityNoteDemoAction(scopeId, note)`;
- `reportAvailabilityConflictDemoAction(scopeId, reason)`.

## Demo-Only Safety

All actions:

- return `DemoActionResult`;
- use `createDemoActionResult`;
- include `role: "partner"` and `riskLevel` in the returned runtime object;
- never write to Supabase;
- never mutate mock data;
- never call payment, Telegram, n8n, or notification services;
- never throw at import time;
- keep `alcoholModuleEnabled: false`.

## Partner Responsibility Zone

Partner can:

- accept or reject new orders;
- mark orders preparing;
- mark orders ready for pickup;
- confirm or reject bookings;
- update future availability in demo mode;
- pause future orders/bookings;
- pause catalog items/categories for future demand;
- report issues.

Partner cannot:

- change payment status;
- force refund;
- cancel accepted orders directly;
- cancel confirmed bookings directly;
- cancel after courier pickup;
- enable alcohol module.

## Stop Button Rules

Stop actions affect future demand only:

- future orders;
- future bookings;
- selected item/category/date/slot;
- full business pause in demo mode.

Stop actions do not:

- cancel accepted orders;
- cancel confirmed bookings;
- cancel delivery in progress;
- change payment status;
- force refund;
- remove audit requirements;
- enable alcohol module.

Emergency stop is `critical` risk and requires human admin approval plus future audit log.

## Accepted Orders And Bookings Protection

Accepted orders and confirmed bookings stay active. Cancellation requests are represented only as demo requests:

- accepted order cancellation: `riskLevel: "high"`, `humanApprovalRequired: true`, `auditRequired: true`;
- confirmed booking cancellation: `riskLevel: "high"`, `humanApprovalRequired: true`, `auditRequired: true`.

Future real implementation must create approval requests, enforce admin review, and write audit logs.

## Admin Approval For High-Risk Actions

Admin approval is required later for:

- accepted order cancellation;
- confirmed booking cancellation;
- emergency stop;
- payment issue;
- refund request;
- cancellation after courier pickup;
- legal/compliance issue;
- alcohol-related request.

## AI And Alcohol Safety

AI can recommend, classify, alert, and draft messages later. AI cannot:

- cancel accepted orders/bookings;
- change payment status;
- approve refund;
- enable alcohol module.

Alcohol compliance:

- `ALCOHOL_MODULE_ENABLED=false`;
- alcohol sales/delivery disabled;
- activation requires legal review, licensing, partner verification, and `super_admin` approval.

# Courier Demo Actions Skeleton

Stage: 12F-3 — Courier Demo Actions Skeleton.

This document describes safe demo skeleton actions for courier internal operations. These actions do not write to Supabase, do not mutate mock data, do not require environment variables, and are not connected to UI yet.

`ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## Created Courier Demo Actions

Courier delivery actions:

- `acceptDeliveryDemoAction(deliveryId)`;
- `markCourierToPartnerDemoAction(deliveryId)`;
- `markArrivedAtPartnerDemoAction(deliveryId)`;
- `markPickedUpDemoAction(deliveryId)`;
- `markCourierToClientDemoAction(deliveryId)`;
- `markArrivedAtClientDemoAction(deliveryId)`;
- `markDeliveredDemoAction(deliveryId)`.

Courier issue actions:

- `reportPartnerNotReadyDemoAction(deliveryId, reason)`;
- `reportWrongOrderDemoAction(deliveryId, reason)`;
- `reportClientNotAnsweringDemoAction(deliveryId, reason)`;
- `reportAddressProblemDemoAction(deliveryId, reason)`;
- `reportTrafficDelayDemoAction(deliveryId, reason)`;
- `reportVehicleProblemDemoAction(deliveryId, reason)`;
- `reportOrderDamagedDemoAction(deliveryId, reason)`;
- `reportEmergencyIncidentDemoAction(deliveryId, reason)`;
- `requestAdminSupportDemoAction(deliveryId, reason)`.

Courier profile actions:

- `updateCourierAvailabilityDemoAction(courierId, available)`;
- `updateCourierShiftStatusDemoAction(courierId, status)`;
- `reportCourierProfileIssueDemoAction(courierId, reason)`.

## Demo-Only Safety

All actions:

- return `DemoActionResult`;
- use `createDemoActionResult`;
- include `role: "courier"` and `riskLevel` in the returned runtime object;
- never write to Supabase;
- never mutate mock data;
- never call payment, Telegram, n8n, GPS, or notification services;
- never throw at import time;
- keep `alcoholModuleEnabled: false`.

## Courier Responsibility Zone

Courier controls physical delivery only:

- accept assigned/available delivery;
- go to partner;
- arrive at partner;
- pick up order;
- go to client;
- arrive at client;
- mark delivered;
- report issues.

Courier cannot:

- change payment status;
- change order items;
- cancel order without admin;
- approve refund;
- edit partner preparation status;
- enable alcohol module.

## Delivery Progress Statuses

Demo delivery progress actions map to the future delivery flow:

- `courier_assigned`;
- `courier_accepted`;
- `courier_to_partner`;
- `arrived_at_partner`;
- `picked_up`;
- `courier_to_client`;
- `arrived_at_client`;
- `delivered`.

Real implementation must validate courier assignment, route state, ownership, and current delivery status before writing.

## Issue Escalation

Medium-risk issues with audit later:

- partner not ready;
- client not answering;
- traffic delay;
- profile issue.

High-risk issues with audit later:

- wrong order;
- address problem;
- vehicle problem;
- order damaged;
- admin support request.

Critical issue:

- emergency incident.

Critical and high-risk actions may require human admin approval. Courier issue actions never change payment status, refunds, order contents, or legal/compliance state.

## Admin Approval For High-Risk Actions

Admin approval is required later for:

- order cancellation;
- refund;
- payment status change;
- delivery status override;
- reassignment after pickup;
- emergency incident;
- legal/compliance issue;
- alcohol-related request.

## AI And Alcohol Safety

AI can recommend, classify severity, alert admin, and draft messages later. AI cannot:

- cancel order;
- change payment status;
- approve refund;
- enable alcohol module.

Alcohol compliance:

- `ALCOHOL_MODULE_ENABLED=false`;
- alcohol sales/delivery disabled;
- activation requires legal review, licensing, partner verification, and `super_admin` approval.

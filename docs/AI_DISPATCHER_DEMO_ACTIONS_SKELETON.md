# AI Dispatcher Demo Actions Skeleton

Stage: 12F-5 — AI Dispatcher Demo Actions Skeleton.

This document describes safe demo skeleton actions for AI dispatcher recommendations, alerts and decision logs. These actions do not write to Supabase, do not mutate mock data, do not require environment variables, and are not connected to UI yet.

`ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## Created AI Dispatcher Demo Actions

AI recommendation actions:

- `recommendCourierAssignmentDemoAction(orderId, reason)`;
- `recommendCourierReassignmentDemoAction(orderId, reason)`;
- `recommendPartnerPauseDemoAction(partnerId, reason)`;
- `recommendIssueEscalationDemoAction(issueId, reason)`;
- `recommendAdminReviewDemoAction(targetId, reason)`;
- `recommendCustomerMessageDemoAction(targetId, messageDraft)`.

AI alert actions:

- `createDelayAlertDemoAction(targetId, reason)`;
- `createPartnerNotReadyAlertDemoAction(orderId, reason)`;
- `createCourierLateAlertDemoAction(deliveryId, reason)`;
- `createClientNotAnsweringAlertDemoAction(deliveryId, reason)`;
- `createPaymentRiskAlertDemoAction(paymentId, reason)`;
- `createCriticalIncidentAlertDemoAction(targetId, reason)`.

AI decision log actions:

- `createAiDecisionLogDemoAction(targetId, decision, reason)`;
- `createAiRecommendationLogDemoAction(targetId, recommendation, reason)`;
- `createAiSafetyRefusalLogDemoAction(targetId, refusedAction, reason)`.

## Demo-Only Safety

All actions:

- return `DemoActionResult`;
- use `createDemoActionResult`;
- include `role: "ai_dispatcher"` and `riskLevel` in the returned runtime object;
- never write to Supabase;
- never mutate mock data;
- never send Telegram/n8n/notification messages;
- never call payment services;
- never throw at import time;
- keep `alcoholModuleEnabled: false`.

## AI Can Recommend, Alert And Log Only

AI dispatcher can:

- recommend;
- classify severity;
- create alert;
- draft message;
- create demo decision log;
- create demo recommendation log;
- create safety refusal log.

AI recommendation does not execute real action.

## AI Cannot Execute High-Risk Actions

AI dispatcher cannot:

- cancel order;
- change payment status;
- approve refund;
- block or unblock users;
- force-complete orders;
- force-close delivery issues;
- enable alcohol module.

High-risk recommendations require human admin approval later.

## Risk And Approval Rules

Medium risk with audit later:

- courier assignment recommendation;
- partner pause recommendation;
- delay alert;
- partner not ready alert;
- courier late alert;
- client not answering alert.

High risk with human approval and audit later:

- courier reassignment recommendation;
- issue escalation recommendation.

Critical risk with human approval and audit later:

- payment risk alert;
- critical incident alert.

Safety refusal logs are high risk and audit-required because AI must record when it refuses a high-risk action.

## Admin Approval And Audit Later

Future real implementation must add:

- admin approval flow;
- risk level calculation;
- audit logs;
- AI recommendation IDs;
- before/after state for approved actions;
- notification routing;
- RLS and role checks.

AI recommendations do not replace human approval.

## Alcohol Module Disabled

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- AI cannot enable alcohol module.
- Any alcohol-related request is critical risk.
- Any future activation requires legal review, licensing, partner verification, and `super_admin` approval.

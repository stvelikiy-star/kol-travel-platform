import { createDemoActionResult, type DemoActionResult } from "@/app/actions/shared/action-result";

type AiDispatcherRiskLevel = "low" | "medium" | "high" | "critical";

function createAiDispatcherDemoActionResult(input: {
  action: string;
  message: string;
  role: "ai_dispatcher";
  riskLevel: AiDispatcherRiskLevel;
  humanApprovalRequired?: boolean;
  auditRequired?: boolean;
}): DemoActionResult {
  const result = createDemoActionResult(input);

  return {
    ...result,
    role: "ai_dispatcher",
    riskLevel: input.riskLevel
  } as DemoActionResult;
}

export function createDelayAlertDemoAction(targetId: string, reason: string): DemoActionResult {
  void targetId;
  void reason;

  // TODO: Create delay alert record later; no real notification is sent now.
  return createAiDispatcherDemoActionResult({
    action: "ai_dispatcher.create_delay_alert",
    message: "Demo delay alert created. Real notifications will be connected later.",
    role: "ai_dispatcher",
    riskLevel: "medium",
    humanApprovalRequired: false,
    auditRequired: true
  });
}

export function createPartnerNotReadyAlertDemoAction(orderId: string, reason: string): DemoActionResult {
  void orderId;
  void reason;

  // TODO: Alert admin when partner readiness is delayed later.
  return createAiDispatcherDemoActionResult({
    action: "ai_dispatcher.create_partner_not_ready_alert",
    message: "Demo partner-not-ready alert created. Admin monitoring will be connected later.",
    role: "ai_dispatcher",
    riskLevel: "medium",
    humanApprovalRequired: false,
    auditRequired: true
  });
}

export function createCourierLateAlertDemoAction(deliveryId: string, reason: string): DemoActionResult {
  void deliveryId;
  void reason;

  // TODO: Alert admin when courier delay exceeds operational thresholds later.
  return createAiDispatcherDemoActionResult({
    action: "ai_dispatcher.create_courier_late_alert",
    message: "Demo courier-late alert created. Real escalation will be connected later.",
    role: "ai_dispatcher",
    riskLevel: "medium",
    humanApprovalRequired: false,
    auditRequired: true
  });
}

export function createClientNotAnsweringAlertDemoAction(deliveryId: string, reason: string): DemoActionResult {
  void deliveryId;
  void reason;

  // TODO: Alert admin/client support when client is unreachable later.
  return createAiDispatcherDemoActionResult({
    action: "ai_dispatcher.create_client_not_answering_alert",
    message: "Demo client-not-answering alert created. Human follow-up will be connected later.",
    role: "ai_dispatcher",
    riskLevel: "medium",
    humanApprovalRequired: false,
    auditRequired: true
  });
}

export function createPaymentRiskAlertDemoAction(paymentId: string, reason: string): DemoActionResult {
  void paymentId;
  void reason;

  // TODO: Create critical finance alert later; AI cannot change payment status or approve refund.
  return createAiDispatcherDemoActionResult({
    action: "ai_dispatcher.create_payment_risk_alert",
    message: "Demo payment risk alert created. Critical finance actions require human admin approval.",
    role: "ai_dispatcher",
    riskLevel: "critical",
    humanApprovalRequired: true,
    auditRequired: true
  });
}

export function createCriticalIncidentAlertDemoAction(targetId: string, reason: string): DemoActionResult {
  void targetId;
  void reason;

  // TODO: Create critical incident alert and notify human admin later.
  return createAiDispatcherDemoActionResult({
    action: "ai_dispatcher.create_critical_incident_alert",
    message: "Demo critical incident alert created. Human admin approval is required.",
    role: "ai_dispatcher",
    riskLevel: "critical",
    humanApprovalRequired: true,
    auditRequired: true
  });
}

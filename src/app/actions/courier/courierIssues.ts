import { createDemoActionResult, type DemoActionResult } from "@/app/actions/shared/action-result";

type CourierRiskLevel = "low" | "medium" | "high" | "critical";

function createCourierDemoActionResult(input: {
  action: string;
  message: string;
  role: "courier";
  riskLevel: CourierRiskLevel;
  humanApprovalRequired?: boolean;
  auditRequired?: boolean;
}): DemoActionResult {
  const result = createDemoActionResult(input);

  return {
    ...result,
    role: "courier",
    riskLevel: input.riskLevel
  } as DemoActionResult;
}

export function reportPartnerNotReadyDemoAction(deliveryId: string, reason: string): DemoActionResult {
  void deliveryId;
  void reason;

  // TODO: Create partner delay issue, notify admin/AI dispatcher and audit later.
  return createCourierDemoActionResult({
    action: "courier.report_partner_not_ready",
    message: "Demo partner-not-ready issue reported. Admin review will be connected later.",
    role: "courier",
    riskLevel: "medium",
    humanApprovalRequired: false,
    auditRequired: true
  });
}

export function reportWrongOrderDemoAction(deliveryId: string, reason: string): DemoActionResult {
  void deliveryId;
  void reason;

  // TODO: Create wrong-order issue and block pickup until admin/partner clarification later.
  return createCourierDemoActionResult({
    action: "courier.report_wrong_order",
    message: "Demo wrong-order issue reported. Pickup should wait for admin/partner clarification.",
    role: "courier",
    riskLevel: "high",
    humanApprovalRequired: false,
    auditRequired: true
  });
}

export function reportClientNotAnsweringDemoAction(deliveryId: string, reason: string): DemoActionResult {
  void deliveryId;
  void reason;

  // TODO: Create client contact issue and notify admin later.
  return createCourierDemoActionResult({
    action: "courier.report_client_not_answering",
    message: "Demo client-not-answering issue reported. Admin escalation will be connected later.",
    role: "courier",
    riskLevel: "medium",
    humanApprovalRequired: false,
    auditRequired: true
  });
}

export function reportAddressProblemDemoAction(deliveryId: string, reason: string): DemoActionResult {
  void deliveryId;
  void reason;

  // TODO: Create wrong-address issue and request admin/client clarification later.
  return createCourierDemoActionResult({
    action: "courier.report_address_problem",
    message: "Demo address problem reported. Human clarification will be connected later.",
    role: "courier",
    riskLevel: "high",
    humanApprovalRequired: false,
    auditRequired: true
  });
}

export function reportTrafficDelayDemoAction(deliveryId: string, reason: string): DemoActionResult {
  void deliveryId;
  void reason;

  // TODO: Create route delay event and AI/admin alert later.
  return createCourierDemoActionResult({
    action: "courier.report_traffic_delay",
    message: "Demo traffic delay reported. AI delay monitoring will be connected later.",
    role: "courier",
    riskLevel: "medium",
    humanApprovalRequired: false,
    auditRequired: true
  });
}

export function reportVehicleProblemDemoAction(deliveryId: string, reason: string): DemoActionResult {
  void deliveryId;
  void reason;

  // TODO: Create vehicle issue and request reassignment/admin support later.
  return createCourierDemoActionResult({
    action: "courier.report_vehicle_problem",
    message: "Demo vehicle problem reported. Reassignment/admin support will be connected later.",
    role: "courier",
    riskLevel: "high",
    humanApprovalRequired: false,
    auditRequired: true
  });
}

export function reportOrderDamagedDemoAction(deliveryId: string, reason: string): DemoActionResult {
  void deliveryId;
  void reason;

  // TODO: Create damaged-order dispute; refunds/payment changes require admin approval later.
  return createCourierDemoActionResult({
    action: "courier.report_order_damaged",
    message: "Demo damaged-order issue reported. Refund/payment decisions require admin approval later.",
    role: "courier",
    riskLevel: "high",
    humanApprovalRequired: false,
    auditRequired: true
  });
}

export function reportEmergencyIncidentDemoAction(deliveryId: string, reason: string): DemoActionResult {
  void deliveryId;
  void reason;

  // TODO: Create critical incident, notify human admin and write audit log later.
  return createCourierDemoActionResult({
    action: "courier.report_emergency_incident",
    message: "Demo emergency incident reported. Critical risk requires human admin approval.",
    role: "courier",
    riskLevel: "critical",
    humanApprovalRequired: true,
    auditRequired: true
  });
}

export function requestAdminSupportDemoAction(deliveryId: string, reason: string): DemoActionResult {
  void deliveryId;
  void reason;

  // TODO: Create admin support request and audit log later.
  // Safety: courier cannot cancel order, change payment or enable alcohol module.
  return createCourierDemoActionResult({
    action: "courier.request_admin_support",
    message: "Demo admin support request created. Human admin approval is required for high-risk actions.",
    role: "courier",
    riskLevel: "high",
    humanApprovalRequired: true,
    auditRequired: true
  });
}

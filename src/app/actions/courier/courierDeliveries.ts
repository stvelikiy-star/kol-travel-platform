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

export function acceptDeliveryDemoAction(deliveryId: string): DemoActionResult {
  void deliveryId;

  // TODO: Validate courier session, assignment and availability before accepting real delivery later.
  return createCourierDemoActionResult({
    action: "courier.accept_delivery",
    message: "Demo delivery accepted. Real courier assignment state will be connected later.",
    role: "courier",
    riskLevel: "low",
    humanApprovalRequired: false,
    auditRequired: false
  });
}

export function markCourierToPartnerDemoAction(deliveryId: string): DemoActionResult {
  void deliveryId;

  // TODO: Validate accepted delivery and update route progress in a future server action.
  return createCourierDemoActionResult({
    action: "courier.mark_to_partner",
    message: "Demo courier progress marked: going to partner.",
    role: "courier",
    riskLevel: "low",
    humanApprovalRequired: false,
    auditRequired: false
  });
}

export function markArrivedAtPartnerDemoAction(deliveryId: string): DemoActionResult {
  void deliveryId;

  // TODO: Validate GPS/arrival evidence later; courier controls only physical delivery progress.
  return createCourierDemoActionResult({
    action: "courier.mark_arrived_at_partner",
    message: "Demo courier progress marked: arrived at partner.",
    role: "courier",
    riskLevel: "low",
    humanApprovalRequired: false,
    auditRequired: false
  });
}

export function markPickedUpDemoAction(deliveryId: string): DemoActionResult {
  void deliveryId;

  // TODO: Validate partner handoff and pickup confirmation later.
  // Safety: courier cannot change order items or payment status.
  return createCourierDemoActionResult({
    action: "courier.mark_picked_up",
    message: "Demo courier progress marked: order picked up.",
    role: "courier",
    riskLevel: "low",
    humanApprovalRequired: false,
    auditRequired: false
  });
}

export function markCourierToClientDemoAction(deliveryId: string): DemoActionResult {
  void deliveryId;

  // TODO: Update delivery progress to courier_to_client after pickup validation later.
  return createCourierDemoActionResult({
    action: "courier.mark_to_client",
    message: "Demo courier progress marked: going to client.",
    role: "courier",
    riskLevel: "low",
    humanApprovalRequired: false,
    auditRequired: false
  });
}

export function markArrivedAtClientDemoAction(deliveryId: string): DemoActionResult {
  void deliveryId;

  // TODO: Validate arrival at client location later.
  return createCourierDemoActionResult({
    action: "courier.mark_arrived_at_client",
    message: "Demo courier progress marked: arrived at client.",
    role: "courier",
    riskLevel: "low",
    humanApprovalRequired: false,
    auditRequired: false
  });
}

export function markDeliveredDemoAction(deliveryId: string): DemoActionResult {
  void deliveryId;

  // TODO: Validate handoff proof and complete delivery later.
  // Safety: courier cannot cancel order without admin and cannot enable alcohol module.
  return createCourierDemoActionResult({
    action: "courier.mark_delivered",
    message: "Demo delivery marked delivered. Real completion will be connected later.",
    role: "courier",
    riskLevel: "low",
    humanApprovalRequired: false,
    auditRequired: false
  });
}

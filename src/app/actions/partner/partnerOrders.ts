import { createDemoActionResult, type DemoActionResult } from "@/app/actions/shared/action-result";

type PartnerRiskLevel = "low" | "medium" | "high" | "critical";

function createPartnerDemoActionResult(input: {
  action: string;
  message: string;
  role: "partner";
  riskLevel: PartnerRiskLevel;
  humanApprovalRequired?: boolean;
  auditRequired?: boolean;
}): DemoActionResult {
  const actionInput = {
    ...input,
    role: "partner" as const
  };
  const result = createDemoActionResult(actionInput);

  return {
    ...result,
    role: "partner",
    riskLevel: input.riskLevel
  } as DemoActionResult;
}

export function acceptPartnerOrderDemoAction(orderId: string): DemoActionResult {
  void orderId;

  // TODO: Validate partner session, ownership and current order status before writing partner_accepted later.
  // Safety: partner cannot change payment status and cannot cancel after courier pickup.
  return createPartnerDemoActionResult({
    action: "partner.accept_order",
    message: "Demo partner order accepted. Real CRM status change will be connected later.",
    role: "partner",
    riskLevel: "low",
    humanApprovalRequired: false,
    auditRequired: false
  });
}

export function rejectPartnerOrderDemoAction(orderId: string, reason: string): DemoActionResult {
  void orderId;
  void reason;

  // TODO: Validate rejection window and notify client/admin in a future server action.
  // Safety: rejected orders must not change payment status here.
  return createPartnerDemoActionResult({
    action: "partner.reject_order",
    message: "Demo partner order rejection recorded. Real rejection flow will be connected later.",
    role: "partner",
    riskLevel: "medium",
    humanApprovalRequired: false,
    auditRequired: false
  });
}

export function markOrderPreparingDemoAction(orderId: string): DemoActionResult {
  void orderId;

  // TODO: Validate partner ownership and transition order into preparing in a future server action.
  return createPartnerDemoActionResult({
    action: "partner.mark_order_preparing",
    message: "Demo order marked as preparing. No real status was changed.",
    role: "partner",
    riskLevel: "low",
    humanApprovalRequired: false,
    auditRequired: false
  });
}

export function markOrderReadyForPickupDemoAction(orderId: string): DemoActionResult {
  void orderId;

  // TODO: Validate preparation state and notify delivery dispatcher in a future server action.
  // Safety: after ready_for_pickup, courier/admin delivery systems control the physical delivery.
  return createPartnerDemoActionResult({
    action: "partner.mark_order_ready_for_pickup",
    message: "Demo order marked ready for pickup. Courier assignment will be connected later.",
    role: "partner",
    riskLevel: "medium",
    humanApprovalRequired: false,
    auditRequired: false
  });
}

export function reportPartnerOrderIssueDemoAction(orderId: string, reason: string): DemoActionResult {
  void orderId;
  void reason;

  // TODO: Create a partner issue record, notify admin and write audit logs later.
  return createPartnerDemoActionResult({
    action: "partner.report_order_issue",
    message: "Demo partner order issue reported. Admin review will be connected later.",
    role: "partner",
    riskLevel: "medium",
    humanApprovalRequired: false,
    auditRequired: true
  });
}

export function requestAcceptedOrderCancellationDemoAction(orderId: string, reason: string): DemoActionResult {
  void orderId;
  void reason;

  // TODO: Create a high-risk cancellation request for admin approval and audit logging later.
  // Safety: partner cannot cancel accepted orders directly and cannot cancel after courier pickup.
  return createPartnerDemoActionResult({
    action: "partner.request_accepted_order_cancellation",
    message: "Demo accepted order cancellation request created. Human admin approval is required.",
    role: "partner",
    riskLevel: "high",
    humanApprovalRequired: true,
    auditRequired: true
  });
}

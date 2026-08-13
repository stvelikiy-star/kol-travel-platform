import { createDemoActionResult, type DemoActionResult } from "@/app/actions/shared/action-result";

export function assignCourierDemoAction(orderId: string, courierId: string): DemoActionResult {
  void orderId;
  void courierId;

  // TODO: Validate admin role, courier availability and delivery ownership before real assignment later.
  return createDemoActionResult({
    action: "admin.assign_courier",
    message: "Demo courier assignment request recorded. No real delivery state was changed.",
    role: "admin",
    riskLevel: "medium",
    humanApprovalRequired: false,
    auditRequired: true
  });
}

export function reassignCourierAfterPickupDemoAction(deliveryId: string, reason: string): DemoActionResult {
  void deliveryId;
  void reason;

  // TODO: Require high-risk approval and audit before reassignment after pickup.
  return createDemoActionResult({
    action: "admin.reassign_courier_after_pickup",
    message: "Demo high-risk courier reassignment request created. Human approval is required.",
    role: "admin",
    riskLevel: "high",
    humanApprovalRequired: true,
    auditRequired: true
  });
}

export function forceCompleteOrderRequestDemoAction(orderId: string, reason: string): DemoActionResult {
  void orderId;
  void reason;

  // TODO: Require high-risk approval, delivery checks and audit before force completion.
  return createDemoActionResult({
    action: "admin.force_complete_order_request",
    message: "Demo force-complete order request created. Human approval and audit are required.",
    role: "admin",
    riskLevel: "high",
    humanApprovalRequired: true,
    auditRequired: true
  });
}

export function forceCloseDeliveryIssueRequestDemoAction(issueId: string, reason: string): DemoActionResult {
  void issueId;
  void reason;

  // TODO: Require high-risk approval and audit before force-closing issue.
  return createDemoActionResult({
    action: "admin.force_close_delivery_issue_request",
    message: "Demo force-close delivery issue request created. Human approval and audit are required.",
    role: "admin",
    riskLevel: "high",
    humanApprovalRequired: true,
    auditRequired: true
  });
}

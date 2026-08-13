import { createDemoActionResult, type DemoActionResult } from "@/app/actions/shared/action-result";

export function requestPaymentStatusChangeDemoAction(paymentId: string, reason: string): DemoActionResult {
  void paymentId;
  void reason;

  // TODO: Validate finance admin role and create approval request before any real payment status change.
  return createDemoActionResult({
    action: "admin.request_payment_status_change",
    message: "Demo payment status change request created. Human approval and audit are required.",
    role: "admin",
    riskLevel: "critical",
    humanApprovalRequired: true,
    auditRequired: true
  });
}

export function approveRefundRequestDemoAction(refundId: string, reason: string): DemoActionResult {
  void refundId;
  void reason;

  // TODO: Require finance/admin approval workflow before real refund.
  return createDemoActionResult({
    action: "admin.approve_refund_request",
    message: "Demo refund approval request recorded. No real refund was created.",
    role: "admin",
    riskLevel: "critical",
    humanApprovalRequired: true,
    auditRequired: true
  });
}

export function createPayoutRequestDemoAction(targetId: string, reason: string): DemoActionResult {
  void targetId;
  void reason;

  // TODO: Validate finance rules before any payout creation later.
  return createDemoActionResult({
    action: "admin.create_payout_request",
    message: "Demo payout request recorded. Real payouts will be connected later.",
    role: "admin",
    riskLevel: "high",
    humanApprovalRequired: true,
    auditRequired: true
  });
}

export function adjustCommissionRequestDemoAction(partnerId: string, reason: string): DemoActionResult {
  void partnerId;
  void reason;

  // TODO: Require finance approval and audit before commission changes.
  return createDemoActionResult({
    action: "admin.adjust_commission_request",
    message: "Demo commission adjustment request recorded. Human approval and audit are required.",
    role: "admin",
    riskLevel: "high",
    humanApprovalRequired: true,
    auditRequired: true
  });
}

import { createDemoActionResult, type DemoActionResult } from "@/app/actions/shared/action-result";

export function moderateCatalogItemDemoAction(itemId: string, decision: "approve" | "reject" | "revise"): DemoActionResult {
  void itemId;
  void decision;

  // TODO: Validate admin moderation role and write catalog moderation decision later.
  return createDemoActionResult({
    action: "admin.moderate_catalog_item",
    message: "Demo catalog moderation decision recorded. No real catalog item was changed.",
    role: "admin",
    riskLevel: "medium",
    humanApprovalRequired: false,
    auditRequired: true
  });
}

export function verifyPartnerRequestDemoAction(partnerId: string, decision: "approve" | "reject", reason: string): DemoActionResult {
  void partnerId;
  void decision;
  void reason;

  // TODO: Validate partner verification evidence and audit decision later.
  return createDemoActionResult({
    action: "admin.verify_partner_request",
    message: "Demo partner verification decision recorded. Real verification will be connected later.",
    role: "admin",
    riskLevel: "high",
    humanApprovalRequired: true,
    auditRequired: true
  });
}

export function blockPartnerRequestDemoAction(partnerId: string, reason: string): DemoActionResult {
  void partnerId;
  void reason;

  // TODO: Require high-risk approval before blocking partner.
  return createDemoActionResult({
    action: "admin.block_partner_request",
    message: "Demo partner block request created. Human approval and audit are required.",
    role: "admin",
    riskLevel: "high",
    humanApprovalRequired: true,
    auditRequired: true
  });
}

export function blockCourierRequestDemoAction(courierId: string, reason: string): DemoActionResult {
  void courierId;
  void reason;

  // TODO: Require high-risk approval before blocking courier.
  return createDemoActionResult({
    action: "admin.block_courier_request",
    message: "Demo courier block request created. Human approval and audit are required.",
    role: "admin",
    riskLevel: "high",
    humanApprovalRequired: true,
    auditRequired: true
  });
}

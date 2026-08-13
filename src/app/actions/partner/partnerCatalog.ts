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

export function pauseCatalogItemDemoAction(itemId: string, reason: string): DemoActionResult {
  void itemId;
  void reason;

  // TODO: Pause selected catalog item for future orders/bookings only.
  return createPartnerDemoActionResult({
    action: "partner.pause_catalog_item",
    message: "Demo catalog item pause recorded. Accepted orders/bookings stay active.",
    role: "partner",
    riskLevel: "medium",
    humanApprovalRequired: false,
    auditRequired: false
  });
}

export function resumeCatalogItemDemoAction(itemId: string): DemoActionResult {
  void itemId;

  // TODO: Resume selected catalog item after moderation/ownership checks later.
  return createPartnerDemoActionResult({
    action: "partner.resume_catalog_item",
    message: "Demo catalog item resume recorded. Real catalog writes will be connected later.",
    role: "partner",
    riskLevel: "low",
    humanApprovalRequired: false,
    auditRequired: false
  });
}

export function markCatalogItemOutOfStockDemoAction(itemId: string, reason: string): DemoActionResult {
  void itemId;
  void reason;

  // TODO: Mark item out of stock for future checkout only; accepted work remains active.
  return createPartnerDemoActionResult({
    action: "partner.mark_catalog_item_out_of_stock",
    message: "Demo catalog item marked out of stock. Accepted orders/bookings stay active.",
    role: "partner",
    riskLevel: "medium",
    humanApprovalRequired: false,
    auditRequired: false
  });
}

export function pauseCatalogCategoryDemoAction(categoryId: string, reason: string): DemoActionResult {
  void categoryId;
  void reason;

  // TODO: Pause category scope for future demand after partner ownership validation later.
  return createPartnerDemoActionResult({
    action: "partner.pause_catalog_category",
    message: "Demo catalog category pause recorded. Existing accepted work is not cancelled.",
    role: "partner",
    riskLevel: "medium",
    humanApprovalRequired: false,
    auditRequired: false
  });
}

export function reportCatalogIssueDemoAction(itemId: string, reason: string): DemoActionResult {
  void itemId;
  void reason;

  // TODO: Create catalog issue record and audit log later.
  return createPartnerDemoActionResult({
    action: "partner.report_catalog_issue",
    message: "Demo catalog issue reported. Admin/moderation review will be connected later.",
    role: "partner",
    riskLevel: "medium",
    humanApprovalRequired: false,
    auditRequired: true
  });
}

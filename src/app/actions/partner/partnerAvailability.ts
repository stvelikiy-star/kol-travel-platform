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

export function blockAvailabilityDateDemoAction(scopeId: string, date: string, reason: string): DemoActionResult {
  void scopeId;
  void date;
  void reason;

  // TODO: Block future availability date after checking confirmed bookings and partner ownership later.
  return createPartnerDemoActionResult({
    action: "partner.block_availability_date",
    message: "Demo availability date blocked. Confirmed bookings stay active.",
    role: "partner",
    riskLevel: "medium",
    humanApprovalRequired: false,
    auditRequired: false
  });
}

export function unblockAvailabilityDateDemoAction(scopeId: string, date: string): DemoActionResult {
  void scopeId;
  void date;

  // TODO: Reopen future availability date after conflict checks later.
  return createPartnerDemoActionResult({
    action: "partner.unblock_availability_date",
    message: "Demo availability date reopened. Real availability writes will be connected later.",
    role: "partner",
    riskLevel: "low",
    humanApprovalRequired: false,
    auditRequired: false
  });
}

export function blockAvailabilitySlotDemoAction(scopeId: string, slot: string, reason: string): DemoActionResult {
  void scopeId;
  void slot;
  void reason;

  // TODO: Block future time slot after checking schedules/bookings later.
  return createPartnerDemoActionResult({
    action: "partner.block_availability_slot",
    message: "Demo availability slot blocked. Confirmed bookings stay active.",
    role: "partner",
    riskLevel: "medium",
    humanApprovalRequired: false,
    auditRequired: false
  });
}

export function updateAvailabilityNoteDemoAction(scopeId: string, note: string): DemoActionResult {
  void scopeId;
  void note;

  // TODO: Update partner-facing availability note after ownership validation later.
  return createPartnerDemoActionResult({
    action: "partner.update_availability_note",
    message: "Demo availability note updated. No real data was changed.",
    role: "partner",
    riskLevel: "low",
    humanApprovalRequired: false,
    auditRequired: false
  });
}

export function reportAvailabilityConflictDemoAction(scopeId: string, reason: string): DemoActionResult {
  void scopeId;
  void reason;

  // TODO: Create availability conflict issue and audit log later.
  return createPartnerDemoActionResult({
    action: "partner.report_availability_conflict",
    message: "Demo availability conflict reported. Admin review will be connected later.",
    role: "partner",
    riskLevel: "medium",
    humanApprovalRequired: false,
    auditRequired: true
  });
}

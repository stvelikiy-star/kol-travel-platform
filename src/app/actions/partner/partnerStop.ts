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

export function pauseFutureOrdersDemoAction(reason: string, plannedResumeTime?: string): DemoActionResult {
  void reason;
  void plannedResumeTime;

  // TODO: Create PartnerStopStatus for future orders only; accepted orders continue.
  return createPartnerDemoActionResult({
    action: "partner.pause_future_orders",
    message: "Demo future orders pause created. Accepted orders are not cancelled.",
    role: "partner",
    riskLevel: "medium",
    humanApprovalRequired: false,
    auditRequired: false
  });
}

export function pauseFutureBookingsDemoAction(reason: string, plannedResumeTime?: string): DemoActionResult {
  void reason;
  void plannedResumeTime;

  // TODO: Create PartnerStopStatus for future bookings only; confirmed bookings continue.
  return createPartnerDemoActionResult({
    action: "partner.pause_future_bookings",
    message: "Demo future bookings pause created. Confirmed bookings are not cancelled.",
    role: "partner",
    riskLevel: "medium",
    humanApprovalRequired: false,
    auditRequired: false
  });
}

export function pauseFullBusinessDemoAction(reason: string, plannedResumeTime?: string): DemoActionResult {
  void reason;
  void plannedResumeTime;

  // TODO: Create full-business pause with audit log later.
  // Safety: full business pause blocks future demand only and does not change payments.
  return createPartnerDemoActionResult({
    action: "partner.pause_full_business",
    message: "Demo full business pause created. Accepted orders/bookings remain active.",
    role: "partner",
    riskLevel: "high",
    humanApprovalRequired: false,
    auditRequired: true
  });
}

export function resumeBusinessDemoAction(reason: string): DemoActionResult {
  void reason;

  // TODO: Resume eligible partner stop scopes after validating partner ownership later.
  return createPartnerDemoActionResult({
    action: "partner.resume_business",
    message: "Demo business resume request recorded. Real resume logic will be connected later.",
    role: "partner",
    riskLevel: "medium",
    humanApprovalRequired: false,
    auditRequired: false
  });
}

export function emergencyStopRequestDemoAction(reason: string): DemoActionResult {
  void reason;

  // TODO: Create critical emergency stop request for admin approval and audit logging later.
  // Safety: stop button cannot cancel accepted orders/bookings, change payment or enable alcohol module.
  return createPartnerDemoActionResult({
    action: "partner.emergency_stop_request",
    message: "Demo emergency stop request created. Critical risk requires human admin approval.",
    role: "partner",
    riskLevel: "critical",
    humanApprovalRequired: true,
    auditRequired: true
  });
}

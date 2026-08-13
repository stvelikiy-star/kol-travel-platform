import { createDemoActionResult, type DemoActionResult } from "@/app/actions/shared/action-result";

type CourierRiskLevel = "low" | "medium" | "high" | "critical";
type CourierShiftStatus = "online" | "offline" | "busy";

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

export function updateCourierAvailabilityDemoAction(courierId: string, available: boolean): DemoActionResult {
  void courierId;
  void available;

  // TODO: Validate courier session and update availability in a future server action.
  return createCourierDemoActionResult({
    action: "courier.update_availability",
    message: "Demo courier availability update recorded. Real shift logic will be connected later.",
    role: "courier",
    riskLevel: "low",
    humanApprovalRequired: false,
    auditRequired: false
  });
}

export function updateCourierShiftStatusDemoAction(courierId: string, status: CourierShiftStatus): DemoActionResult {
  void courierId;
  void status;

  // TODO: Validate shift ownership and write courier_shifts/courier_profiles later.
  return createCourierDemoActionResult({
    action: "courier.update_shift_status",
    message: "Demo courier shift status update recorded. Real shift status will be connected later.",
    role: "courier",
    riskLevel: "low",
    humanApprovalRequired: false,
    auditRequired: false
  });
}

export function reportCourierProfileIssueDemoAction(courierId: string, reason: string): DemoActionResult {
  void courierId;
  void reason;

  // TODO: Create courier profile/support issue and audit log later.
  // Safety: earnings, payouts and payment status cannot be changed here.
  return createCourierDemoActionResult({
    action: "courier.report_profile_issue",
    message: "Demo courier profile issue reported. Admin review will be connected later.",
    role: "courier",
    riskLevel: "medium",
    humanApprovalRequired: false,
    auditRequired: true
  });
}

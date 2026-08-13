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

export function confirmPartnerBookingDemoAction(bookingId: string): DemoActionResult {
  void bookingId;

  // TODO: Validate partner ownership, availability and booking status before confirming later.
  return createPartnerDemoActionResult({
    action: "partner.confirm_booking",
    message: "Demo booking confirmed by partner. Real booking CRM will be connected later.",
    role: "partner",
    riskLevel: "low",
    humanApprovalRequired: false,
    auditRequired: false
  });
}

export function rejectPartnerBookingDemoAction(bookingId: string, reason: string): DemoActionResult {
  void bookingId;
  void reason;

  // TODO: Validate rejection rules and notify client/admin in a future server action.
  return createPartnerDemoActionResult({
    action: "partner.reject_booking",
    message: "Demo booking rejection recorded. Real rejection flow will be connected later.",
    role: "partner",
    riskLevel: "medium",
    humanApprovalRequired: false,
    auditRequired: false
  });
}

export function markGuestArrivedDemoAction(bookingId: string): DemoActionResult {
  void bookingId;

  // TODO: Validate confirmed stay/tour booking before marking guest arrival later.
  return createPartnerDemoActionResult({
    action: "partner.mark_guest_arrived",
    message: "Demo guest arrival recorded. No real booking status was changed.",
    role: "partner",
    riskLevel: "low",
    humanApprovalRequired: false,
    auditRequired: false
  });
}

export function reportPartnerBookingIssueDemoAction(bookingId: string, reason: string): DemoActionResult {
  void bookingId;
  void reason;

  // TODO: Create a booking issue record, notify admin and write audit logs later.
  return createPartnerDemoActionResult({
    action: "partner.report_booking_issue",
    message: "Demo partner booking issue reported. Admin review will be connected later.",
    role: "partner",
    riskLevel: "medium",
    humanApprovalRequired: false,
    auditRequired: true
  });
}

export function requestConfirmedBookingCancellationDemoAction(bookingId: string, reason: string): DemoActionResult {
  void bookingId;
  void reason;

  // TODO: Create a high-risk confirmed booking cancellation request for admin approval later.
  // Safety: confirmed booking cancellation requires admin approval and audit.
  return createPartnerDemoActionResult({
    action: "partner.request_confirmed_booking_cancellation",
    message: "Demo confirmed booking cancellation request created. Human admin approval is required.",
    role: "partner",
    riskLevel: "high",
    humanApprovalRequired: true,
    auditRequired: true
  });
}

import { createDemoActionResult, type DemoActionResult } from "@/app/actions/shared/action-result";

export function createBookingDemoAction(input: unknown): DemoActionResult {
  void input;

  // TODO: Validate availability, client session and booking rules before creating a real booking later.
  // Safety: alcohol module remains OFF; no payment status changes happen here.
  return createDemoActionResult({
    action: "client.create_booking",
    message: "Demo booking request accepted. Real booking creation will be connected later.",
    auditRequired: false
  });
}

export function cancelBookingRequestDemoAction(bookingId: string, reason: string): DemoActionResult {
  void bookingId;
  void reason;

  // TODO: Create a cancellation request, enforce booking rules and write audit logs in a future server action.
  // Safety: confirmed bookings require admin approval before cancellation.
  return createDemoActionResult({
    action: "client.cancel_booking_request",
    message: "Demo booking cancellation request created. Confirmed bookings require admin approval before cancellation.",
    humanApprovalRequired: true,
    auditRequired: true
  });
}

export function updateBookingRequestDemoAction(
  bookingId: string,
  input: unknown
): DemoActionResult {
  void bookingId;
  void input;

  // TODO: Validate ownership, availability and partner rules before updating real booking dates later.
  return createDemoActionResult({
    action: "client.update_booking_request",
    message: "Demo booking update request created. Real date changes will be checked by availability rules later.",
    humanApprovalRequired: true,
    auditRequired: true
  });
}

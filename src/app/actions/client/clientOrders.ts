import { createDemoActionResult, type DemoActionResult } from "@/app/actions/shared/action-result";

export function createOrderDemoAction(input: unknown): DemoActionResult {
  void input;

  // TODO: Validate client session, cart ownership, partner availability and write order rows in a future server action.
  // Safety: payment status cannot be changed here; alcohol module remains OFF.
  return createDemoActionResult({
    action: "client.create_order",
    message: "Demo order request accepted. Real order creation will be connected later.",
    auditRequired: false
  });
}

export function cancelOrderRequestDemoAction(orderId: string, reason: string): DemoActionResult {
  void orderId;
  void reason;

  // TODO: Create a cancellation request, require admin approval for accepted orders, and write audit logs later.
  // Safety: accepted orders require admin approval before cancellation; payment status cannot be changed here.
  return createDemoActionResult({
    action: "client.cancel_order_request",
    message: "Demo order cancellation request created. Accepted orders require admin approval before cancellation.",
    humanApprovalRequired: true,
    auditRequired: true
  });
}

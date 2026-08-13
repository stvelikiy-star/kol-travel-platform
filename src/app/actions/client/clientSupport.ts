import { createDemoActionResult, type DemoActionResult } from "@/app/actions/shared/action-result";

export function createSupportTicketDemoAction(input: unknown): DemoActionResult {
  void input;

  // TODO: Validate client session and create support_tickets/ticket_messages rows later.
  return createDemoActionResult({
    action: "client.create_support_ticket",
    message: "Demo support ticket created. Real support CRM will be connected later.",
    auditRequired: false
  });
}

export function replySupportTicketDemoAction(ticketId: string, message: string): DemoActionResult {
  void ticketId;
  void message;

  // TODO: Validate ticket ownership before appending real ticket messages later.
  return createDemoActionResult({
    action: "client.reply_support_ticket",
    message: "Demo support ticket reply accepted. Real ticket messaging will be connected later.",
    auditRequired: false
  });
}

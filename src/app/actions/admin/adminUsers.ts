import { createDemoActionResult, type DemoActionResult } from "@/app/actions/shared/action-result";

export function changeUserRoleRequestDemoAction(userId: string, nextRole: string, reason: string): DemoActionResult {
  void userId;
  void nextRole;
  void reason;

  // TODO: Require super/admin approval and audit before role changes.
  return createDemoActionResult({
    action: "admin.change_user_role_request",
    message: "Demo user role change request recorded. Human approval and audit are required.",
    role: "admin",
    riskLevel: "high",
    humanApprovalRequired: true,
    auditRequired: true
  });
}

export function blockUserRequestDemoAction(userId: string, reason: string): DemoActionResult {
  void userId;
  void reason;

  // TODO: Require admin approval and audit before blocking user.
  return createDemoActionResult({
    action: "admin.block_user_request",
    message: "Demo user block request recorded. Human approval and audit are required.",
    role: "admin",
    riskLevel: "high",
    humanApprovalRequired: true,
    auditRequired: true
  });
}

export function unblockUserRequestDemoAction(userId: string, reason: string): DemoActionResult {
  void userId;
  void reason;

  // TODO: Require admin approval and audit before unblocking user.
  return createDemoActionResult({
    action: "admin.unblock_user_request",
    message: "Demo user unblock request recorded. Human approval and audit are required.",
    role: "admin",
    riskLevel: "high",
    humanApprovalRequired: true,
    auditRequired: true
  });
}

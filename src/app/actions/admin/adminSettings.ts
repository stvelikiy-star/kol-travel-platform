import { createDemoActionResult, type DemoActionResult } from "@/app/actions/shared/action-result";

export function updatePlatformSettingRequestDemoAction(settingKey: string, reason: string): DemoActionResult {
  void settingKey;
  void reason;

  // TODO: Require super/admin approval and audit before real platform settings changes.
  return createDemoActionResult({
    action: "admin.update_platform_setting_request",
    message: "Demo platform setting change request recorded. Human approval and audit are required.",
    role: "admin",
    riskLevel: "high",
    humanApprovalRequired: true,
    auditRequired: true
  });
}

export function requestAlcoholModuleComplianceReviewDemoAction(reason: string): DemoActionResult {
  void reason;

  // Safety: alcohol module remains OFF. This only creates a demo compliance review request.
  return createDemoActionResult({
    action: "admin.request_alcohol_module_compliance_review",
    message: "Demo alcohol compliance review request recorded. Alcohol module remains disabled.",
    role: "admin",
    riskLevel: "critical",
    humanApprovalRequired: true,
    auditRequired: true
  });
}

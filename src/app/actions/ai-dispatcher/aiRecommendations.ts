import { createDemoActionResult, type DemoActionResult } from "@/app/actions/shared/action-result";

type AiDispatcherRiskLevel = "low" | "medium" | "high" | "critical";

function createAiDispatcherDemoActionResult(input: {
  action: string;
  message: string;
  role: "ai_dispatcher";
  riskLevel: AiDispatcherRiskLevel;
  humanApprovalRequired?: boolean;
  auditRequired?: boolean;
}): DemoActionResult {
  const result = createDemoActionResult(input);

  return {
    ...result,
    role: "ai_dispatcher",
    riskLevel: input.riskLevel
  } as DemoActionResult;
}

export function recommendCourierAssignmentDemoAction(orderId: string, reason: string): DemoActionResult {
  void orderId;
  void reason;

  // TODO: Read delivery/courier availability and create a real recommendation later.
  // Safety: AI recommendation does not assign courier or execute real action.
  return createAiDispatcherDemoActionResult({
    action: "ai_dispatcher.recommend_courier_assignment",
    message: "Demo courier assignment recommendation created. Human/admin review will be connected later.",
    role: "ai_dispatcher",
    riskLevel: "medium",
    humanApprovalRequired: false,
    auditRequired: true
  });
}

export function recommendCourierReassignmentDemoAction(orderId: string, reason: string): DemoActionResult {
  void orderId;
  void reason;

  // TODO: Create high-risk reassignment recommendation and require admin approval later.
  return createAiDispatcherDemoActionResult({
    action: "ai_dispatcher.recommend_courier_reassignment",
    message: "Demo courier reassignment recommendation created. Human admin approval is required for high-risk reassignment.",
    role: "ai_dispatcher",
    riskLevel: "high",
    humanApprovalRequired: true,
    auditRequired: true
  });
}

export function recommendPartnerPauseDemoAction(partnerId: string, reason: string): DemoActionResult {
  void partnerId;
  void reason;

  // TODO: Recommend partner pause based on overload or availability signals later.
  // Safety: AI cannot pause partner directly.
  return createAiDispatcherDemoActionResult({
    action: "ai_dispatcher.recommend_partner_pause",
    message: "Demo partner pause recommendation created. AI does not pause partner directly.",
    role: "ai_dispatcher",
    riskLevel: "medium",
    humanApprovalRequired: false,
    auditRequired: true
  });
}

export function recommendIssueEscalationDemoAction(issueId: string, reason: string): DemoActionResult {
  void issueId;
  void reason;

  // TODO: Create high-risk escalation recommendation for human admin review later.
  return createAiDispatcherDemoActionResult({
    action: "ai_dispatcher.recommend_issue_escalation",
    message: "Demo issue escalation recommendation created. Human admin approval is required for high-risk action.",
    role: "ai_dispatcher",
    riskLevel: "high",
    humanApprovalRequired: true,
    auditRequired: true
  });
}

export function recommendAdminReviewDemoAction(targetId: string, reason: string): DemoActionResult {
  void targetId;
  void reason;

  // TODO: Create admin review recommendation later; AI does not execute the review outcome.
  return createAiDispatcherDemoActionResult({
    action: "ai_dispatcher.recommend_admin_review",
    message: "Demo admin review recommendation created. Real admin workflow will be connected later.",
    role: "ai_dispatcher",
    riskLevel: "medium",
    humanApprovalRequired: false,
    auditRequired: true
  });
}

export function recommendCustomerMessageDemoAction(targetId: string, messageDraft: string): DemoActionResult {
  void targetId;
  void messageDraft;

  // TODO: Draft customer-facing message later; human/admin review may be applied before sending.
  return createAiDispatcherDemoActionResult({
    action: "ai_dispatcher.recommend_customer_message",
    message: "Demo customer message draft created. No notification was sent.",
    role: "ai_dispatcher",
    riskLevel: "low",
    humanApprovalRequired: false,
    auditRequired: false
  });
}

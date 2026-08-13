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

export function createAiDecisionLogDemoAction(targetId: string, decision: string, reason: string): DemoActionResult {
  void targetId;
  void decision;
  void reason;

  // TODO: Write ai_decision_logs row later; no real persistence now.
  return createAiDispatcherDemoActionResult({
    action: "ai_dispatcher.create_decision_log",
    message: "Demo AI decision log created. Real decision logging will be connected later.",
    role: "ai_dispatcher",
    riskLevel: "low",
    humanApprovalRequired: false,
    auditRequired: true
  });
}

export function createAiRecommendationLogDemoAction(targetId: string, recommendation: string, reason: string): DemoActionResult {
  void targetId;
  void recommendation;
  void reason;

  // TODO: Write AI recommendation log later; recommendation does not execute action.
  return createAiDispatcherDemoActionResult({
    action: "ai_dispatcher.create_recommendation_log",
    message: "Demo AI recommendation log created. No action was executed.",
    role: "ai_dispatcher",
    riskLevel: "low",
    humanApprovalRequired: false,
    auditRequired: true
  });
}

export function createAiSafetyRefusalLogDemoAction(targetId: string, refusedAction: string, reason: string): DemoActionResult {
  void targetId;
  void refusedAction;
  void reason;

  // TODO: Persist safety refusal when AI refuses high-risk action later.
  // Safety: AI must refuse cancellation, payment changes, refunds, user blocking and alcohol enablement.
  return createAiDispatcherDemoActionResult({
    action: "ai_dispatcher.create_safety_refusal_log",
    message: "Demo AI safety refusal log created. High-risk action was not executed.",
    role: "ai_dispatcher",
    riskLevel: "high",
    humanApprovalRequired: false,
    auditRequired: true
  });
}

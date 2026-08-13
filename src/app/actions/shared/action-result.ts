export type DemoActionRole = "client" | "partner" | "courier" | "admin" | "ai_dispatcher";

export type DemoActionRiskLevel = "low" | "medium" | "high" | "critical";

export type DemoActionResult = {
  ok: boolean;
  mode: "demo";
  action: string;
  message: string;
  role?: DemoActionRole;
  riskLevel?: DemoActionRiskLevel;
  humanApprovalRequired?: boolean;
  auditRequired?: boolean;
  alcoholModuleEnabled?: false;
};

export function createDemoActionResult(input: {
  action: string;
  message: string;
  role?: DemoActionRole;
  riskLevel?: DemoActionRiskLevel;
  humanApprovalRequired?: boolean;
  auditRequired?: boolean;
}): DemoActionResult {
  return {
    ok: true,
    mode: "demo",
    action: input.action,
    message: input.message,
    role: input.role,
    riskLevel: input.riskLevel,
    humanApprovalRequired: input.humanApprovalRequired ?? false,
    auditRequired: input.auditRequired ?? false,
    alcoholModuleEnabled: false
  };
}

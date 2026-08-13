export type AuditActorRole =
  | "client"
  | "partner"
  | "courier"
  | "admin"
  | "super_admin"
  | "ai_dispatcher_system";

export type AuditRiskLevel = "low" | "medium" | "high" | "critical";

export type AuditActionType =
  | "mark_order_ready_for_pickup"
  | "high_risk_approval_created"
  | "high_risk_approval_approved"
  | "high_risk_approval_rejected"
  | "high_risk_approval_expired"
  | "high_risk_approval_cancelled"
  | "recommendation_created"
  | "alert_created"
  | "safety_refusal"
  | "high_risk_suggestion"
  | string;

export type AuditTargetTable =
  | "orders"
  | "bookings"
  | "deliveries"
  | "partners"
  | "couriers"
  | "users"
  | "payments"
  | "refunds"
  | "audit_logs"
  | "high_risk_approvals"
  | "ai_recommendations"
  | "ai_alerts"
  | "ai_decision_logs"
  | string;

export type AuditLogInput = {
  actorUserId: string;
  actorRole: AuditActorRole;
  actionType: AuditActionType;
  targetTable: AuditTargetTable;
  targetId: string;
  beforeState?: unknown;
  afterState?: unknown;
  reason?: string;
  riskLevel: AuditRiskLevel;
  humanApprovalRequired: boolean;
  approvalId?: string;
};

export type AuditSafeErrorCode =
  | "audit_validation_failed"
  | "audit_insert_failed"
  | "audit_not_configured"
  | "server_error";

export type AuditSafeError = {
  ok: false;
  code: AuditSafeErrorCode;
  message: string;
};

export type AuditLogResult =
  | {
      ok: true;
      auditLogId?: string;
      message: string;
    }
  | {
      ok: false;
      code: AuditSafeErrorCode;
      message: string;
    };

import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  createAuditNotConfiguredError,
  createAuditServerError,
  createAuditValidationError,
  toAuditLogResult
} from "@/lib/audit/errors";
import { sanitizeAuditState } from "@/lib/audit/sanitize";
import type { AuditActorRole, AuditLogInput, AuditLogResult, AuditRiskLevel } from "@/lib/audit/types";

const validActorRoles: AuditActorRole[] = [
  "client",
  "partner",
  "courier",
  "admin",
  "super_admin",
  "ai_dispatcher_system"
];

const validRiskLevels: AuditRiskLevel[] = ["low", "medium", "high", "critical"];

function hasValue(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateAuditInput(input: AuditLogInput): AuditLogResult | null {
  if (!hasValue(input.actorUserId)) {
    return toAuditLogResult(createAuditValidationError("actorUserId is required."));
  }

  if (!validActorRoles.includes(input.actorRole)) {
    return toAuditLogResult(createAuditValidationError("actorRole is invalid."));
  }

  if (!hasValue(input.actionType)) {
    return toAuditLogResult(createAuditValidationError("actionType is required."));
  }

  if (!hasValue(input.targetTable)) {
    return toAuditLogResult(createAuditValidationError("targetTable is required."));
  }

  if (!hasValue(input.targetId)) {
    return toAuditLogResult(createAuditValidationError("targetId is required."));
  }

  if (!validRiskLevels.includes(input.riskLevel)) {
    return toAuditLogResult(createAuditValidationError("riskLevel is invalid."));
  }

  return null;
}

export async function createAuditLogEntry(input: AuditLogInput): Promise<AuditLogResult> {
  try {
    const validationError = validateAuditInput(input);

    if (validationError) {
      return validationError;
    }

    const client = getSupabaseServerClient();

    if (!client?.isConfigured) {
      return toAuditLogResult(createAuditNotConfiguredError());
    }

    const _payload = {
      actor_user_id: input.actorUserId,
      actor_role: input.actorRole,
      action_type: input.actionType,
      target_table: input.targetTable,
      target_id: input.targetId,
      before_state: sanitizeAuditState(input.beforeState),
      after_state: sanitizeAuditState(input.afterState),
      reason: input.reason,
      risk_level: input.riskLevel,
      human_approval_required: input.humanApprovalRequired,
      approval_id: input.approvalId
    };
    void _payload;

    // TODO: Insert _payload into audit_logs after the real Supabase server client
    // is enabled and RLS/audit table behavior is verified. This helper must not
    // mutate business records.
    return toAuditLogResult(createAuditNotConfiguredError());
  } catch {
    return toAuditLogResult(createAuditServerError());
  }
}

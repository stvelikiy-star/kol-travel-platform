import type { AuditLogResult, AuditSafeError } from "@/lib/audit/types";

export function createAuditValidationError(message: string): AuditSafeError {
  return {
    ok: false,
    code: "audit_validation_failed",
    message
  };
}

export function createAuditInsertError(): AuditSafeError {
  return {
    ok: false,
    code: "audit_insert_failed",
    message: "Audit log could not be created."
  };
}

export function createAuditNotConfiguredError(): AuditSafeError {
  return {
    ok: false,
    code: "audit_not_configured",
    message: "Audit logging is not configured for the current safe mode."
  };
}

export function createAuditServerError(): AuditSafeError {
  return {
    ok: false,
    code: "server_error",
    message: "Audit logging service is unavailable."
  };
}

export function toAuditLogResult(error: AuditSafeError): AuditLogResult {
  return {
    ok: false,
    code: error.code,
    message: error.message
  };
}

import type { SafeAuthError, SafeAuthErrorCode } from "@/lib/auth/types";

export function createAuthError(code: SafeAuthErrorCode, message: string): SafeAuthError {
  return {
    ok: false,
    code,
    message
  };
}

export function createNotAuthenticatedError() {
  return createAuthError("not_authenticated", "Authentication is required for this action.");
}

export function createNotAuthorizedError() {
  return createAuthError("not_authorized", "You are not authorized to perform this action.");
}

export function createProfileNotFoundError() {
  return createAuthError("profile_not_found", "User profile was not found.");
}

export function createProfileInactiveError() {
  return createAuthError("profile_inactive", "User profile is not active.");
}

export function createOwnershipError() {
  return createAuthError("ownership_failed", "Ownership check failed.");
}

export function createSafeServerError() {
  return createAuthError("server_error", "Authentication service is unavailable.");
}

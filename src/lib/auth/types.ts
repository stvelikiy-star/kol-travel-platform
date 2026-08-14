export type UserRole =
  | "client"
  | "partner_owner"
  | "partner_manager"
  | "partner_staff"
  | "courier"
  | "dispatcher"
  | "support_admin"
  | "finance_admin"
  | "super_admin"
  | "ai_dispatcher_system";

export const userRoles: readonly UserRole[] = [
  "client",
  "partner_owner",
  "partner_manager",
  "partner_staff",
  "courier",
  "dispatcher",
  "support_admin",
  "finance_admin",
  "super_admin",
  "ai_dispatcher_system"
];

export type AuthProfileStatus = "active" | "blocked" | "pending" | "inactive";

export type AuthProfile = {
  userId: string;
  email?: string;
  role: UserRole;
  status: AuthProfileStatus;
  clientId?: string;
  partnerId?: string;
  courierId?: string;
};

export type SafeAuthErrorCode =
  | "not_authenticated"
  | "not_authorized"
  | "profile_not_found"
  | "profile_inactive"
  | "ownership_failed"
  | "invalid_role"
  | "invalid_target"
  | "server_error";

export type SafeAuthError = {
  ok: false;
  code: SafeAuthErrorCode;
  message: string;
};

export type AuthHelperResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: SafeAuthError };

export type AuthSessionUser = {
  id: string;
  email?: string;
  accessToken?: string;
};

export type OwnershipCheck = {
  userId: string;
  role: UserRole;
  targetId: string;
  ownerId?: string;
};

export type OwnershipCheckResult = AuthHelperResult<OwnershipCheck>;

import { createNotAuthorizedError } from "@/lib/auth/errors";
import { requireActiveProfile } from "@/lib/auth/profile";
import type { AuthHelperResult, AuthProfile, UserRole } from "@/lib/auth/types";

export type AppRole =
  | "guest"
  | "client"
  | "partner_owner"
  | "partner_manager"
  | "partner_staff"
  | "courier"
  | "dispatcher"
  | "support_admin"
  | "finance_admin"
  | "super_admin";

export const appRoles: AppRole[] = [
  "guest",
  "client",
  "partner_owner",
  "partner_manager",
  "partner_staff",
  "courier",
  "dispatcher",
  "support_admin",
  "finance_admin",
  "super_admin"
];

export const partnerRoles: UserRole[] = ["partner_owner", "partner_manager", "partner_staff"];
export const adminRoles: UserRole[] = ["dispatcher", "support_admin", "finance_admin", "super_admin"];

export type { UserRole } from "@/lib/auth/types";

export const userRoles: UserRole[] = [
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

export async function requireRole(allowedRoles: UserRole[]): Promise<AuthHelperResult<AuthProfile>> {
  const profile = await requireActiveProfile();

  if (!profile.ok) {
    return profile;
  }

  if (!allowedRoles.includes(profile.data.role)) {
    return { ok: false, error: createNotAuthorizedError() };
  }

  return profile;
}

export function requireClient() {
  return requireRole(["client"]);
}

export function requirePartner() {
  return requireRole(partnerRoles);
}

export function requireCourier() {
  return requireRole(["courier"]);
}

export function requireAdmin() {
  return requireRole(adminRoles);
}

export function requireSuperAdmin() {
  return requireRole(["super_admin"]);
}

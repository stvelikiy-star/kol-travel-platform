/** Privileged MFA is staged: never lock out the existing SUPER ADMIN before setup. */
import type { UserRole } from "@/lib/auth/types";

const privilegedRoles = new Set<UserRole>(["super_admin", "finance_admin"]);

export function isPrivilegedMfaRequired(role: UserRole, enforce = process.env.KOL_ADMIN_MFA_ENFORCE === "true"): boolean {
  return enforce && privilegedRoles.has(role);
}

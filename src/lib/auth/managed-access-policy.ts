/** Explicit allowlist: clients and super_admins cannot be provisioned through staff invitations. */
export const managedRoles = [
  "dispatcher", "support_admin", "finance_admin", "content_manager",
  "partner_owner", "partner_manager", "partner_staff", "courier"
] as const;

export type ManagedRole = (typeof managedRoles)[number];

export const managedPartnerRoles: readonly ManagedRole[] = ["partner_owner", "partner_manager", "partner_staff"];
export const managedAdminRoles: readonly ManagedRole[] = ["dispatcher", "support_admin", "finance_admin", "content_manager"];

export function isManagedRole(value: string): value is ManagedRole {
  return (managedRoles as readonly string[]).includes(value);
}

export function isManagedPartnerRole(role: ManagedRole): boolean {
  return managedPartnerRoles.includes(role);
}

/** Account-type changes require audited, atomic profile/scope reassignment. */
export function canSwitchManagedRole(current: ManagedRole, next: ManagedRole): boolean {
  if (current === next) return false;
  return (managedAdminRoles.includes(current) && managedAdminRoles.includes(next)) ||
    (managedPartnerRoles.includes(current) && managedPartnerRoles.includes(next));
}

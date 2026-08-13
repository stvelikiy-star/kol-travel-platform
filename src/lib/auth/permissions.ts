import type { AppRole } from "@/lib/auth/roles";

export function canAccessClientDashboard(role: AppRole) {
  return role === "client" || role === "super_admin";
}

export function canAccessPartnerDashboard(role: AppRole) {
  return role === "partner_owner" || role === "partner_manager" || role === "partner_staff" || role === "super_admin";
}

export function canAccessCourierDashboard(role: AppRole) {
  return role === "courier" || role === "dispatcher" || role === "super_admin";
}

export function canAccessAdminPanel(role: AppRole) {
  return role === "dispatcher" || role === "support_admin" || role === "finance_admin" || role === "super_admin";
}

export function canManageFinance(role: AppRole) {
  return role === "finance_admin" || role === "super_admin";
}

export function canApproveHighRiskAIAction(role: AppRole) {
  return role === "dispatcher" || role === "super_admin";
}

export function canEnableAlcoholModule(_role: AppRole) {
  return false;
}

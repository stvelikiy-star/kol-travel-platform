import { redirect } from "next/navigation";
import { isAuthProtectionEnabled } from "@/lib/auth/protection";
import { requireActiveProfile } from "@/lib/auth/profile";
import {
  canAccessAdminPanel,
  canAccessClientDashboard,
  canAccessCourierDashboard,
  canAccessPartnerDashboard
} from "@/lib/auth/permissions";
import type { AppRole } from "@/lib/auth/roles";
import type { AuthProfile } from "@/lib/auth/types";

export type ProtectedArea = "client" | "partner" | "courier" | "admin";

function canAccess(area: ProtectedArea, role: AppRole) {
  if (area === "client") return canAccessClientDashboard(role);
  if (area === "partner") return canAccessPartnerDashboard(role);
  if (area === "courier") return canAccessCourierDashboard(role);
  return canAccessAdminPanel(role);
}

export async function protectRoute(area: ProtectedArea, nextPath: string): Promise<AuthProfile | null> {
  if (!isAuthProtectionEnabled()) {
    return null;
  }

  const result = await requireActiveProfile();

  if (!result.ok) {
    if (result.error.code === "not_authenticated") {
      redirect(`/login?next=${encodeURIComponent(nextPath)}`);
    }
    if (result.error.code === "profile_not_found") {
      redirect("/profile-required");
    }
    if (result.error.code === "profile_inactive") {
      redirect("/account-blocked");
    }
    redirect("/not-authorized");
  }

  const role = result.data.role as AppRole;
  if (!canAccess(area, role)) {
    redirect("/not-authorized");
  }

  return result.data;
}

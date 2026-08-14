import {
  createAuthError,
  createProfileInactiveError,
  createProfileNotFoundError,
  createSafeServerError
} from "@/lib/auth/errors";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import {
  userRoles,
  type AuthHelperResult,
  type AuthProfile,
  type AuthProfileStatus,
  type UserRole
} from "@/lib/auth/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function normalizeStatus(value: string | null | undefined): AuthProfileStatus {
  if (value === "active" || value === "blocked" || value === "pending" || value === "inactive") {
    return value;
  }

  return "inactive";
}

function isUserRole(value: string): value is UserRole {
  return userRoles.includes(value as UserRole);
}

export async function getCurrentUserProfile(): Promise<AuthHelperResult<AuthProfile>> {
  try {
    const session = await requireAuthenticatedUser();

    if (!session.ok) {
      return session;
    }

    const supabase = await createSupabaseServerClient();

    if (!supabase) {
      return { ok: false, error: createSafeServerError() };
    }

    const { data: baseProfile, error: profileError } = await supabase
      .from("user_profiles")
      .select("user_id,email,status")
      .eq("user_id", session.data.id)
      .maybeSingle();

    if (profileError) {
      return { ok: false, error: createSafeServerError() };
    }

    if (!baseProfile) {
      return { ok: false, error: createProfileNotFoundError() };
    }

    const { data: roleRows, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.data.id)
      .eq("is_active", true);

    if (roleError) {
      return { ok: false, error: createSafeServerError() };
    }

    const activeRoles = ((roleRows ?? []) as Array<{ role: string | null }>)
      .map((row) => String(row.role ?? ""));
    const [role] = activeRoles;

    // Existing docs allow multiple roles only with an explicit selected role scope.
    // No role selector exists yet, so fail closed instead of silently ignoring
    // duplicate or unrecognized active role rows.
    if (activeRoles.length !== 1 || !role || !isUserRole(role)) {
      return {
        ok: false,
        error: createAuthError("invalid_role", "A single active role scope is required.")
      };
    }

    const profile: AuthProfile = {
      userId: session.data.id,
      email: session.data.email ?? baseProfile.email ?? undefined,
      role,
      status: normalizeStatus(baseProfile.status)
    };

    if (role === "client") {
      const { data, error } = await supabase
        .from("client_profiles")
        .select("user_id")
        .eq("user_id", session.data.id)
        .maybeSingle();

      if (error || !data) {
        return { ok: false, error: createProfileNotFoundError() };
      }
      profile.clientId = session.data.id;
    }

    if (role === "partner_owner" || role === "partner_manager" || role === "partner_staff") {
      const { data, error } = await supabase
        .from("partner_profiles")
        .select("business_id")
        .eq("user_id", session.data.id)
        .maybeSingle();

      if (error || !data?.business_id) {
        return { ok: false, error: createProfileNotFoundError() };
      }
      profile.partnerId = data.business_id;
    }

    if (role === "courier") {
      const { data, error } = await supabase
        .from("courier_profiles")
        .select("user_id")
        .eq("user_id", session.data.id)
        .maybeSingle();

      if (error || !data) {
        return { ok: false, error: createProfileNotFoundError() };
      }
      profile.courierId = session.data.id;
    }

    if (role === "dispatcher" || role === "support_admin" || role === "finance_admin" || role === "super_admin") {
      const { data, error } = await supabase
        .from("admin_profiles")
        .select("user_id")
        .eq("user_id", session.data.id)
        .maybeSingle();

      if (error || !data) {
        return { ok: false, error: createProfileNotFoundError() };
      }
    }

    return { ok: true, data: profile };
  } catch {
    return { ok: false, error: createSafeServerError() };
  }
}

export async function requireActiveProfile(): Promise<AuthHelperResult<AuthProfile>> {
  const profile = await getCurrentUserProfile();

  if (!profile.ok) {
    return profile;
  }

  if (profile.data.status !== "active") {
    return { ok: false, error: createProfileInactiveError() };
  }

  return profile;
}

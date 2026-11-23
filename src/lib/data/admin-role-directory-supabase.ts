import { requireSuperAdmin } from "@/lib/auth/roles";
import { isSupabaseMode } from "@/lib/data/data-source";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminRoleDirectoryItem = {
  userId: string;
  email: string | null;
  fullName: string | null;
  status: string;
  createdAt: string;
  availabilityStatus?: string;
  workingZone?: string | null;
  vehicleType?: string | null;
  vehicleNumber?: string | null;
};

export type AdminRoleDirectoryResult = {
  ok: boolean;
  items: AdminRoleDirectoryItem[];
  total: number;
  reason?: "not_authorized" | "not_live" | "unavailable";
};

type BaseRoleProfile = {
  user_id: string;
  created_at: string;
  availability_status?: string;
  working_zone?: string | null;
  vehicle_type?: string | null;
  vehicle_number?: string | null;
};

type UserBase = { user_id: string; email: string | null; full_name: string | null; status: string };

export async function getAdminRoleDirectoryReadResult(role: "client" | "courier"): Promise<AdminRoleDirectoryResult> {
  const admin = await requireSuperAdmin();
  if (!admin.ok) return { ok: false, items: [], total: 0, reason: "not_authorized" };
  if (!isSupabaseMode()) return { ok: false, items: [], total: 0, reason: "not_live" };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, items: [], total: 0, reason: "unavailable" };

  const table = role === "courier" ? "courier_profiles" : "client_profiles";
  const fields = role === "courier"
    ? "user_id,created_at,availability_status,working_zone,vehicle_type,vehicle_number"
    : "user_id,created_at";
  const { data, count, error } = await supabase.from(table)
    .select(fields, { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(50);
  if (error || !Array.isArray(data)) return { ok: false, items: [], total: 0, reason: "unavailable" };

  const profiles = data as unknown as BaseRoleProfile[];
  if (profiles.some(profile => !profile || typeof profile.user_id !== "string" ||
      typeof profile.created_at !== "string")) {
    return { ok: false, items: [], total: 0, reason: "unavailable" };
  }
  const ids = profiles.map(profile => profile.user_id);
  if (ids.length === 0) return { ok: true, items: [], total: 0 };

  const { data: users, error: usersError } = await supabase.from("user_profiles")
    .select("user_id,email,full_name,status")
    .in("user_id", ids);
  if (usersError || !Array.isArray(users)) return { ok: false, items: [], total: 0, reason: "unavailable" };
  const byId = new Map((users as UserBase[]).map(user => [user.user_id, user]));

  return {
    ok: true,
    total: count ?? profiles.length,
    items: profiles.map(profile => {
      const user = byId.get(profile.user_id);
      return {
        userId: profile.user_id,
        email: user?.email ?? null,
        fullName: user?.full_name ?? null,
        status: user?.status ?? "profile_missing",
        createdAt: profile.created_at,
        ...(role === "courier" ? {
          availabilityStatus: profile.availability_status ?? "unknown",
          workingZone: profile.working_zone,
          vehicleType: profile.vehicle_type,
          vehicleNumber: profile.vehicle_number
        } : {})
      };
    })
  };
}

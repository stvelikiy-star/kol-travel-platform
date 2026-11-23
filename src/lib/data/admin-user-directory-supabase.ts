import { requireSuperAdmin } from "@/lib/auth/roles";
import { isSupabaseMode } from "@/lib/data/data-source";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export type AdminDirectoryUser = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  status: string;
  created_at: string;
  role?: string;
  roleActive?: boolean;
};

export type AdminDirectoryResult = {
  ok: boolean;
  items: AdminDirectoryUser[];
  total: number;
  reason?: "not_authorized" | "not_live" | "unavailable" | "invalid_query";
};

export async function getAdminUserDirectoryReadResult(search: string): Promise<AdminDirectoryResult> {
  const admin = await requireSuperAdmin();
  if (!admin.ok) return { ok: false, items: [], total: 0, reason: "not_authorized" };
  if (!isSupabaseMode()) return { ok: false, items: [], total: 0, reason: "not_live" };

  const queryText = search.trim();
  if (queryText.length > 64 || !/^[A-Za-z0-9@._+\- ]*$/.test(queryText)) {
    return { ok: false, items: [], total: 0, reason: "invalid_query" };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, items: [], total: 0, reason: "unavailable" };

  let query = supabase.from("user_profiles")
    .select("user_id,email,full_name,status,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(50);
  if (queryText) query = query.ilike("email", "%" + queryText + "%");
  const { data, count, error } = await query;
  if (error || !Array.isArray(data)) return { ok: false, items: [], total: 0, reason: "unavailable" };

  const items = data as AdminDirectoryUser[];
  if (items.length) {
    try {
      // Role inventory is an owner-only server read; never send service keys to the browser.
      const svc = createSupabaseServiceRoleClient();
      const { data: roleRows, error: roleError } = await svc.from("user_roles")
        .select("user_id,role,is_active")
        .in("user_id", items.map((user) => user.user_id));
      if (roleError) throw roleError;
      const roles = new Map<string, Array<{ role: string; is_active: boolean }>>();
      for (const roleRow of (roleRows ?? [])) {
        const group = roles.get(roleRow.user_id) ?? [];
        group.push({ role: roleRow.role, is_active: roleRow.is_active });
        roles.set(roleRow.user_id, group);
      }
      for (const item of items) {
        const group = roles.get(item.user_id);
        if (group?.length === 1) {
          item.role = group[0].role;
          item.roleActive = group[0].is_active;
        }
      }
    } catch { return { ok: false, items: [], total: 0, reason: "unavailable" }; }
  }
  return { ok: true, items, total: count ?? data.length };
}


/** Owner-only partner options; never use IDs supplied by a non-admin client as authority. */
export async function getManagedPartnerOptions(): Promise<Array<{ id: string; title: string }>> {
  const admin = await requireSuperAdmin();
  if (!admin.ok || !isSupabaseMode()) return [];
  try {
    const svc = createSupabaseServiceRoleClient();
    const { data, error } = await svc.from("partners").select("id,title").order("title").limit(100);
    if (error) return [];
    return (data ?? []) as Array<{ id: string; title: string }>;
  } catch { return []; }
}

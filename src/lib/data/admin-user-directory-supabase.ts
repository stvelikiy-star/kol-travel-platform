import { requireSuperAdmin } from "@/lib/auth/roles";
import { isSupabaseMode } from "@/lib/data/data-source";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminDirectoryUser = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  status: string;
  created_at: string;
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

  return { ok: true, items: data as AdminDirectoryUser[], total: count ?? data.length };
}

import { requireAdmin, requireCourier } from "@/lib/auth/roles";
import { isSupabaseMode } from "@/lib/data/data-source";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DeliveryIssueRow = {
  id: string;
  delivery_id: string;
  category: string;
  priority: string;
  status: string;
  description: string | null;
  created_at: string;
};

export type DeliveryIssueReadResult = {
  ok: boolean;
  items: DeliveryIssueRow[];
  source: "supabase" | "disabled";
};

async function loadIssues(userId?: string): Promise<DeliveryIssueReadResult> {
  if (!isSupabaseMode()) return { ok: false, items: [], source: "disabled" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, items: [], source: "supabase" };
  let query = supabase.from("delivery_issues")
    .select("id,delivery_id,category,priority,status,description,created_at")
    .order("created_at", { ascending: false }).limit(30);
  if (userId) query = query.eq("created_by", userId);
  const { data, error } = await query;
  if (error || !Array.isArray(data)) return { ok: false, items: [], source: "supabase" };
  return { ok: true, items: data as DeliveryIssueRow[], source: "supabase" };
}

export async function getCourierDeliveryIssuesReadResult(): Promise<DeliveryIssueReadResult> {
  const courier = await requireCourier();
  if (!courier.ok) return { ok: false, items: [], source: "disabled" };
  return loadIssues(courier.data.userId);
}

export async function getAdminDeliveryIssuesReadResult(): Promise<DeliveryIssueReadResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return { ok: false, items: [], source: "disabled" };
  return loadIssues();
}

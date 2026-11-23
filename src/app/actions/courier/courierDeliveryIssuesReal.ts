"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCourier } from "@/lib/auth/roles";
import { isSupabaseMode } from "@/lib/data/data-source";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const categories = new Set(["partner_pickup", "client_address", "damaged_order", "route_safety", "payment_admin"]);
const priorities = new Set(["low", "medium", "high", "critical"]);

function go(code: string): never {
  redirect("/courier/issues?" + new URLSearchParams({ issue: code }).toString());
}

function issueId(userId: string, requestId: string): string {
  // Stable ID makes browser retries of one form unable to create two incidents.
  const hex = createHash("sha256").update("kol-courier-issue-v1:" + userId + ":" + requestId).digest("hex");
  return [hex.slice(0, 8), hex.slice(8, 12), "4" + hex.slice(13, 16), "8" + hex.slice(17, 20), hex.slice(20, 32)].join("-");
}

export async function createCourierDeliveryIssueAction(formData: FormData): Promise<never> {
  const courier = await requireCourier();
  if (!courier.ok) return go("not_authorized");
  if (!isSupabaseMode()) return go("supabase_required");

  const deliveryId = String(formData.get("deliveryId") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const priority = String(formData.get("priority") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const requestId = String(formData.get("requestId") ?? "").trim();

  if (!uuidPattern.test(deliveryId) || !uuidPattern.test(requestId)) return go("invalid_request");
  if (!categories.has(category) || !priorities.has(priority)) return go("invalid_category");
  if (description.length < 12 || description.length > 1000) return go("invalid_description");

  const supabase = await createSupabaseServerClient();
  if (!supabase) return go("service_unavailable");

  // Only deliveries returned to the current courier may be submitted from this UI.
  // RLS on delivery_issues independently enforces the same restriction at INSERT.
  const { data: deliveries, error: assignmentsError } = await supabase.rpc("get_courier_active_deliveries");
  if (assignmentsError || !Array.isArray(deliveries) ||
      !deliveries.some(row => row && typeof row === "object" &&
        (row as Record<string, unknown>).delivery_id === deliveryId)) {
    return go("delivery_not_assigned");
  }

  const { error } = await supabase.from("delivery_issues").insert({
    id: issueId(courier.data.userId, requestId),
    delivery_id: deliveryId,
    category,
    priority,
    status: "open",
    description,
    created_by: courier.data.userId
  });

  if (error) {
    return go(error.code === "23505" ? "duplicate_request" : "create_failed");
  }
  revalidatePath("/courier/issues");
  revalidatePath("/admin/delivery");
  return go("created");
}

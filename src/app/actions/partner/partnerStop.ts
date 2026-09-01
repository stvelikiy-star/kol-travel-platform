"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePartner } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type StopScope = "new_orders" | "new_bookings" | "business";
type StopAction = "pause" | "resume";
const scopes = new Set<StopScope>(["new_orders", "new_bookings", "business"]);
const actions = new Set<StopAction>(["pause", "resume"]);

function finish(state: "success" | "error", action: string, scope: string, code?: string): never {
  const params = new URLSearchParams({ partnerStop: state, action, scope });
  if (code) params.set("code", code);
  redirect(`/partner/stop?${params.toString()}`);
}

export async function partnerStopFormAction(formData: FormData): Promise<never> {
  const scope = String(formData.get("scope") ?? "") as StopScope;
  const action = String(formData.get("action") ?? "") as StopAction;
  const reason = String(formData.get("reason") ?? "").trim();
  const requestId = String(formData.get("requestId") ?? "").trim();
  const resumeAt = String(formData.get("resumeAt") ?? "").trim();

  if (!scopes.has(scope)) finish("error", action || "unknown", scope || "unknown", "invalid_scope");
  if (!actions.has(action)) finish("error", action || "unknown", scope, "invalid_action");
  if (requestId.length < 8 || requestId.length > 128) finish("error", action, scope, "invalid_request_id");
  if (reason.length > 500) finish("error", action, scope, "reason_too_long");
  if (action === "pause" && reason.length < 3) finish("error", action, scope, "reason_required");

  const partner = await requirePartner();
  if (!partner.ok || !partner.data.partnerId) finish("error", action, scope, "not_authorized");
  if (!(["partner_owner", "partner_manager"] as string[]).includes(partner.data.role)) {
    finish("error", action, scope, "manager_role_required");
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) finish("error", action, scope, "supabase_not_configured");

  const { data, error } = await supabase.rpc("partner_stop_action_atomic", {
    p_scope_type: scope,
    p_action: action,
    p_request_id: requestId,
    p_reason: reason || null,
    p_resume_at: resumeAt || null
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    finish("error", action, scope, "action_rejected");
  }
  if ((data as Record<string, unknown>).ok !== true) finish("error", action, scope, "action_not_applied");

  revalidatePath("/partner/stop");
  revalidatePath("/checkout");
  revalidatePath("/booking/checkout");
  finish("success", action, scope);
}

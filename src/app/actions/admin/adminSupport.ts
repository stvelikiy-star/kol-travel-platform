"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminSupportAction = "reply" | "status";
export type AdminSupportStatus = "in_progress" | "resolved" | "closed";

const allowedActions = new Set<AdminSupportAction>(["reply", "status"]);
const allowedStatuses = new Set<AdminSupportStatus>(["in_progress", "resolved", "closed"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isAction(value: string): value is AdminSupportAction {
  return allowedActions.has(value as AdminSupportAction);
}
function isStatus(value: string): value is AdminSupportStatus {
  return allowedStatuses.has(value as AdminSupportStatus);
}
function supportRedirect(
  state: "success" | "error",
  action: string,
  ticketId?: string,
  code?: string
): never {
  const params = new URLSearchParams({ adminSupport: state, action });
  if (ticketId && uuidPattern.test(ticketId)) params.set("ticket", ticketId);
  if (code) params.set("code", code);
  redirect(`/admin/support?${params.toString()}`);
}

export async function adminSupportFormAction(formData: FormData): Promise<never> {
  const ticketId = String(formData.get("ticketId") ?? "");
  const action = String(formData.get("action") ?? "").trim().toLowerCase();
  const requestId = String(formData.get("requestId") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim().toLowerCase();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!uuidPattern.test(ticketId)) return supportRedirect("error", action || "unknown", undefined, "invalid_ticket_id");
  if (!isAction(action)) return supportRedirect("error", action || "unknown", ticketId, "invalid_action");
  if (requestId.length < 8 || requestId.length > 128) {
    return supportRedirect("error", action, ticketId, "invalid_request_id");
  }

  if (action === "reply") {
    if (message.length < 3 || message.length > 4000) {
      return supportRedirect("error", action, ticketId, "invalid_reply");
    }
    if (status || reason) return supportRedirect("error", action, ticketId, "ambiguous_reply_payload");
  } else {
    if (!isStatus(status)) return supportRedirect("error", action, ticketId, "invalid_status");
    if (reason.length < 3 || reason.length > 500) {
      return supportRedirect("error", action, ticketId, "status_reason_required");
    }
    if (message) return supportRedirect("error", action, ticketId, "ambiguous_status_payload");
  }

  const actor = await requireRole(["support_admin", "super_admin"]);
  if (!actor.ok) return supportRedirect("error", action, ticketId, "not_authorized");

  const supabase = await createSupabaseServerClient();
  if (!supabase) return supportRedirect("error", action, ticketId, "supabase_not_configured");

  const { data, error } = await supabase.rpc("admin_support_lifecycle_atomic", {
    p_ticket_id: ticketId,
    p_action: action,
    p_request_id: requestId,
    p_message: action === "reply" ? message : null,
    p_status: action === "status" ? status : null,
    p_reason: action === "status" ? reason : null
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return supportRedirect("error", action, ticketId, "support_mutation_rejected");
  }
  const result = data as Record<string, unknown>;
  if (result.ok !== true || result.ticket_id !== ticketId) {
    return supportRedirect("error", action, ticketId, "support_mutation_not_applied");
  }

  revalidatePath("/admin/support");
  revalidatePath("/client/support");
  return supportRedirect("success", action, ticketId);
}
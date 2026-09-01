"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePartner } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PartnerOrderAction =
  | "accept"
  | "reject"
  | "start_preparing"
  | "mark_ready"
  | "report_issue"
  | "request_cancellation";

const allowedActions = new Set<PartnerOrderAction>([
  "accept",
  "reject",
  "start_preparing",
  "mark_ready",
  "report_issue",
  "request_cancellation"
]);

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isPartnerOrderAction(value: string): value is PartnerOrderAction {
  return allowedActions.has(value as PartnerOrderAction);
}

function safeReturnTo(value: string, orderId: string) {
  if (value === "/partner/orders") return value;
  if (value === `/partner/orders/${orderId}`) return value;
  return "/partner/orders";
}

function actionRedirect(
  returnTo: string,
  state: "success" | "error",
  action: string,
  code?: string
): never {
  const separator = returnTo.includes("?") ? "&" : "?";
  const params = new URLSearchParams({ partnerAction: state, action });
  if (code) params.set("code", code);
  redirect(`${returnTo}${separator}${params.toString()}`);
}

export async function partnerOrderFormAction(formData: FormData): Promise<never> {
  const orderId = String(formData.get("orderId") ?? "");
  const action = String(formData.get("action") ?? "");
  const requestId = String(formData.get("requestId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const returnTo = safeReturnTo(String(formData.get("returnTo") ?? ""), orderId);

  if (!isUuid(orderId)) {
    return actionRedirect(returnTo, "error", action || "unknown", "invalid_order_id");
  }

  if (!isPartnerOrderAction(action)) {
    return actionRedirect(returnTo, "error", action || "unknown", "invalid_action");
  }

  if (requestId.length < 8 || requestId.length > 128) {
    return actionRedirect(returnTo, "error", action, "invalid_request_id");
  }

  if (reason.length > 500) {
    return actionRedirect(returnTo, "error", action, "reason_too_long");
  }

  const partner = await requirePartner();
  if (!partner.ok || !partner.data.partnerId) {
    return actionRedirect(returnTo, "error", action, "not_authorized");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return actionRedirect(returnTo, "error", action, "supabase_not_configured");
  }

  const { data, error } = await supabase.rpc("partner_order_action_atomic", {
    p_order_id: orderId,
    p_action: action,
    p_request_id: requestId,
    p_reason: reason || null
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return actionRedirect(returnTo, "error", action, "action_rejected");
  }

  const result = data as Record<string, unknown>;
  if (result.ok !== true) {
    return actionRedirect(returnTo, "error", action, "action_not_applied");
  }

  revalidatePath("/partner/orders");
  revalidatePath(`/partner/orders/${orderId}`);
  revalidatePath("/client/orders");
  revalidatePath(`/client/orders/${orderId}`);
  revalidatePath("/admin/delivery");

  return actionRedirect(returnTo, "success", action);
}

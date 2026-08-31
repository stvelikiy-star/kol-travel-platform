"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePartner } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PartnerAvailabilityScopeType = "room_date" | "tour_schedule";
export type PartnerAvailabilityAction = "close" | "open" | "report_conflict";

const allowedScopeTypes = new Set<PartnerAvailabilityScopeType>(["room_date", "tour_schedule"]);
const allowedActions = new Set<PartnerAvailabilityAction>(["close", "open", "report_conflict"]);

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isScopeType(value: string): value is PartnerAvailabilityScopeType {
  return allowedScopeTypes.has(value as PartnerAvailabilityScopeType);
}

function isAvailabilityAction(value: string): value is PartnerAvailabilityAction {
  return allowedActions.has(value as PartnerAvailabilityAction);
}

function safeReturnTo(value: string, scopeType: PartnerAvailabilityScopeType | string) {
  if (scopeType === "room_date" && value === "/partner/availability/rooms") return value;
  if (scopeType === "tour_schedule" && value === "/partner/availability/tours") return value;
  return "/partner/availability";
}

function actionRedirect(
  returnTo: string,
  state: "success" | "error",
  action: string,
  code?: string
): never {
  const separator = returnTo.includes("?") ? "&" : "?";
  const params = new URLSearchParams({ partnerAvailability: state, action });
  if (code) params.set("code", code);
  redirect(`${returnTo}${separator}${params.toString()}`);
}

export async function partnerAvailabilityFormAction(formData: FormData): Promise<never> {
  const scopeType = String(formData.get("scopeType") ?? "");
  const scopeId = String(formData.get("scopeId") ?? "");
  const action = String(formData.get("action") ?? "");
  const requestId = String(formData.get("requestId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const returnTo = safeReturnTo(String(formData.get("returnTo") ?? ""), scopeType);

  if (!isScopeType(scopeType)) {
    return actionRedirect(returnTo, "error", action || "unknown", "invalid_scope_type");
  }

  if (!isUuid(scopeId)) {
    return actionRedirect(returnTo, "error", action || "unknown", "invalid_scope_id");
  }

  if (!isAvailabilityAction(action)) {
    return actionRedirect(returnTo, "error", action || "unknown", "invalid_action");
  }

  if (requestId.length < 8 || requestId.length > 128) {
    return actionRedirect(returnTo, "error", action, "invalid_request_id");
  }

  if (reason.length > 500) {
    return actionRedirect(returnTo, "error", action, "reason_too_long");
  }

  const partner = await requirePartner();
  if (!partner.ok) {
    return actionRedirect(returnTo, "error", action, "not_authorized");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return actionRedirect(returnTo, "error", action, "supabase_not_configured");
  }

  const { data, error } = await supabase.rpc("partner_availability_action_atomic", {
    p_scope_type: scopeType,
    p_scope_id: scopeId,
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

  revalidatePath("/partner/availability");
  revalidatePath("/partner/availability/rooms");
  revalidatePath("/partner/availability/tours");
  revalidatePath("/stays");
  revalidatePath("/tours");

  return actionRedirect(returnTo, "success", action);
}

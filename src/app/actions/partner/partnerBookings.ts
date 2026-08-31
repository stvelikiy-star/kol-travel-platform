"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePartner } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PartnerBookingAction =
  | "confirm"
  | "reject"
  | "check_in"
  | "report_issue"
  | "request_cancellation";

const allowedActions = new Set<PartnerBookingAction>([
  "confirm",
  "reject",
  "check_in",
  "report_issue",
  "request_cancellation"
]);

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isPartnerBookingAction(value: string): value is PartnerBookingAction {
  return allowedActions.has(value as PartnerBookingAction);
}

function safeReturnTo(value: string, bookingId: string) {
  if (value === "/partner/bookings") return value;
  if (value === `/partner/bookings/${bookingId}`) return value;
  return "/partner/bookings";
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

export async function partnerBookingFormAction(formData: FormData): Promise<never> {
  const bookingId = String(formData.get("bookingId") ?? "");
  const action = String(formData.get("action") ?? "");
  const requestId = String(formData.get("requestId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const returnTo = safeReturnTo(String(formData.get("returnTo") ?? ""), bookingId);

  if (!isUuid(bookingId)) {
    return actionRedirect(returnTo, "error", action || "unknown", "invalid_booking_id");
  }

  if (!isPartnerBookingAction(action)) {
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

  const { data, error } = await supabase.rpc("partner_booking_action_atomic", {
    p_booking_id: bookingId,
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

  revalidatePath("/partner/bookings");
  revalidatePath(`/partner/bookings/${bookingId}`);
  revalidatePath("/client/bookings");
  revalidatePath(`/client/bookings/${bookingId}`);

  return actionRedirect(returnTo, "success", action);
}

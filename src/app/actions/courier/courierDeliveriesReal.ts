"use server";

import { requireCourier } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DeliveryStatus } from "@/lib/data/delivery";

export type CourierProgressStatus = Exclude<
  DeliveryStatus,
  "delivery_pending" | "courier_assigned" | "delivery_failed"
>;

type CourierDeliveryTransitionResult = {
  ok: boolean;
  action: "courier_delivery_transition";
  message: string;
  deliveryId?: string;
  status?: string;
  code?: string;
};

const allowedRequestedStatuses = new Set<CourierProgressStatus>([
  "courier_accepted",
  "courier_to_partner",
  "arrived_at_partner",
  "picked_up",
  "courier_to_client",
  "arrived_at_client",
  "delivered"
]);

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function transitionCourierDeliveryAction(
  deliveryId: string,
  toStatus: CourierProgressStatus,
  reason?: string
): Promise<CourierDeliveryTransitionResult> {
  if (!isUuid(deliveryId)) {
    return {
      ok: false,
      action: "courier_delivery_transition",
      code: "invalid_delivery_id",
      message: "Invalid delivery id."
    };
  }

  if (!allowedRequestedStatuses.has(toStatus)) {
    return {
      ok: false,
      action: "courier_delivery_transition",
      code: "invalid_status",
      message: "Invalid delivery status."
    };
  }

  if (reason && reason.length > 500) {
    return {
      ok: false,
      action: "courier_delivery_transition",
      code: "reason_too_long",
      message: "Delivery reason is too long."
    };
  }

  const courier = await requireCourier();
  if (!courier.ok) {
    return {
      ok: false,
      action: "courier_delivery_transition",
      code: "not_authorized",
      message: "Active courier access is required."
    };
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      ok: false,
      action: "courier_delivery_transition",
      code: "supabase_not_configured",
      message: "Delivery service is not configured."
    };
  }

  const { data, error } = await supabase.rpc("courier_transition_delivery_atomic", {
    p_delivery_id: deliveryId,
    p_to_status: toStatus,
    p_reason: reason?.trim() || null
  });

  if (error) {
    return {
      ok: false,
      action: "courier_delivery_transition",
      code: "transition_failed",
      message: "Delivery transition was rejected safely."
    };
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {
      ok: false,
      action: "courier_delivery_transition",
      code: "invalid_rpc_result",
      message: "Delivery transition returned an invalid result."
    };
  }

  const result = data as Record<string, unknown>;

  return {
    ok: result.ok === true,
    action: "courier_delivery_transition",
    message: result.ok === true ? "Delivery status updated." : "Delivery status was not changed.",
    deliveryId: typeof result.delivery_id === "string" ? result.delivery_id : undefined,
    status: typeof result.status === "string" ? result.status : undefined
  };
}

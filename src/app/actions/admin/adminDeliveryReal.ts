"use server";

import { requireRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AssignCourierResult = {
  ok: boolean;
  action: "assign_courier";
  message: string;
  deliveryId?: string;
  courierId?: string;
  assignmentId?: string;
  status?: string;
  code?: string;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function assignCourierAction(
  deliveryId: string,
  courierId: string,
  reason?: string
): Promise<AssignCourierResult> {
  if (!isUuid(deliveryId) || !isUuid(courierId)) {
    return {
      ok: false,
      action: "assign_courier",
      code: "invalid_id",
      message: "Invalid delivery or courier id."
    };
  }

  if (reason && reason.length > 500) {
    return {
      ok: false,
      action: "assign_courier",
      code: "reason_too_long",
      message: "Assignment reason is too long."
    };
  }

  const actor = await requireRole(["dispatcher", "super_admin"]);
  if (!actor.ok) {
    return {
      ok: false,
      action: "assign_courier",
      code: "not_authorized",
      message: "Dispatcher or super-admin access is required."
    };
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      ok: false,
      action: "assign_courier",
      code: "supabase_not_configured",
      message: "Delivery service is not configured."
    };
  }

  const { data, error } = await supabase.rpc("assign_courier_atomic", {
    p_delivery_id: deliveryId,
    p_courier_id: courierId,
    p_reason: reason?.trim() || null
  });

  if (error) {
    return {
      ok: false,
      action: "assign_courier",
      code: "assignment_failed",
      message: "Courier assignment was rejected safely."
    };
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {
      ok: false,
      action: "assign_courier",
      code: "invalid_rpc_result",
      message: "Courier assignment returned an invalid result."
    };
  }

  const result = data as Record<string, unknown>;

  return {
    ok: result.ok === true,
    action: "assign_courier",
    message: result.ok === true ? "Courier assigned." : "Courier assignment was not applied.",
    deliveryId: typeof result.delivery_id === "string" ? result.delivery_id : undefined,
    courierId: typeof result.courier_id === "string" ? result.courier_id : undefined,
    assignmentId: typeof result.assignment_id === "string" ? result.assignment_id : undefined,
    status: typeof result.status === "string" ? result.status : undefined
  };
}

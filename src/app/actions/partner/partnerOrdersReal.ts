"use server";

import { requirePartner } from "@/lib/auth/roles";
import { markOrderReadyForPickupAtomicFromSupabase } from "@/lib/data/order-write-supabase";

type RealPartnerOrderActionResult = {
  ok: boolean;
  mode: "real";
  action: "mark_order_ready_for_pickup";
  message: string;
  role: "partner";
  riskLevel: "medium";
  auditRequired: true;
  humanApprovalRequired: false;
  alcoholModuleEnabled: false;
  auditLogId?: string;
  code?: string;
};

function createResult(input: {
  ok: boolean;
  message: string;
  code?: string;
}): RealPartnerOrderActionResult {
  return {
    ok: input.ok,
    mode: "real",
    action: "mark_order_ready_for_pickup",
    message: input.message,
    role: "partner",
    riskLevel: "medium",
    auditRequired: true,
    humanApprovalRequired: false,
    alcoholModuleEnabled: false,
    code: input.code
  };
}

export async function markOrderReadyForPickupAction(
  orderId: string
): Promise<RealPartnerOrderActionResult> {
  const partner = await requirePartner();

  if (!partner.ok || !partner.data.partnerId) {
    return createResult({
      ok: false,
      code: "not_authorized",
      message: "Authenticated partner access is required."
    });
  }

  const result = await markOrderReadyForPickupAtomicFromSupabase(orderId);

  if (!result.ok) {
    return createResult({
      ok: false,
      code: result.code ?? "database_update_failed",
      message: result.message
    });
  }

  return createResult({
    ok: true,
    message: "Order marked ready for pickup with status history and audit in one database transaction."
  });
}

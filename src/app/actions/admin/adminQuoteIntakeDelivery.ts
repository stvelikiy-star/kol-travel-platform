"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const zoneSet = new Set(["cholpon-ata", "bosteri", "karakol", "tamchy", "baktuu-dolonotu", "sary-oy"]);

function quoteRedirect(ticket: string, code: string): never {
  const params = new URLSearchParams({ adminSupport: "error", action: "quote_delivery", code });
  if (uuidPattern.test(ticket)) params.set("ticket", ticket);
  redirect(`/admin/support?${params.toString()}`);
}

export async function adminQuoteIntakeDeliveryAction(formData: FormData): Promise<never> {
  const ticketId = String(formData.get("ticketId") ?? "").trim();
  const businessId = String(formData.get("businessId") ?? "").trim();
  const zoneCode = String(formData.get("zoneCode") ?? "").trim();
  if (!uuidPattern.test(ticketId) || !uuidPattern.test(businessId) || !zoneSet.has(zoneCode)) {
    quoteRedirect(ticketId, "invalid_quote_input");
  }
  const role = await requireRole(["support_admin", "super_admin"]);
  if (!role.ok) quoteRedirect(ticketId, "not_authorized");

  const supabase = await createSupabaseServerClient();
  if (!supabase) quoteRedirect(ticketId, "supabase_not_configured");
  const { data, error } = await supabase.rpc("quote_intake_delivery_fee_atomic", {
    p_ticket_id: ticketId,
    p_business_id: businessId,
    p_zone_code: zoneCode
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    quoteRedirect(ticketId, "delivery_tariff_not_confirmed");
  }
  const result = data as Record<string, unknown>;
  const fee = typeof result.fee_som === "number" || typeof result.fee_som === "string"
    ? Number(result.fee_som) : Number.NaN;
  if (result.ok !== true || result.currency !== "KGS" || result.order_created !== false ||
      result.ticket_id !== ticketId || result.business_id !== businessId ||
      !Number.isFinite(fee) || fee < 0 || fee > 100000) {
    quoteRedirect(ticketId, "delivery_quote_invalid");
  }

  // Query parameters are only a visual hint; the order RPC RE-READS the tariff
  // under a lock and rejects price changes. Never trust this URL for money.
  const params = new URLSearchParams({
    adminSupport: "quote", action: "quote_delivery", ticket: ticketId,
    business: businessId, zone: zoneCode, fee: fee.toFixed(2)
  });
  redirect(`/admin/support?${params.toString()}`);
}

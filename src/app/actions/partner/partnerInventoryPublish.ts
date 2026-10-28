"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePartner } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function partnerPublishInventoryAction(formData: FormData): Promise<never> {
  const scopeType = String(formData.get("scopeType") ?? "");
  const returnTo = scopeType === "room_date" ? "/partner/availability/rooms" : "/partner/availability/tours";
  const scopeId = String(formData.get("parentId") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "").trim();
  const capacity = Number(formData.get("capacity"));
  const priceRaw = String(formData.get("priceOverride") ?? "").trim();
  const requestId = String(formData.get("requestId") ?? "");
  const reject = (code: string): never => redirect(`${returnTo}?inventory=error&code=${encodeURIComponent(code)}`);

  if (scopeType !== "room_date" && scopeType !== "tour_schedule") reject("invalid_scope");
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(scopeId)) reject("invalid_parent");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < new Date().toISOString().slice(0, 10)) reject("invalid_date");
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) reject("invalid_time");
  if (scopeType === "room_date" && time) reject("invalid_room_time");
  if (scopeType === "tour_schedule" && priceRaw) reject("invalid_tour_price");
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) reject("invalid_capacity");
  const price = priceRaw ? Number(priceRaw) : null;
  if (price !== null && (!Number.isFinite(price) || price <= 0 || price > 10000000)) reject("invalid_price");
  if (requestId.length < 8 || requestId.length > 128) reject("invalid_request_id");
  const partner = await requirePartner();
  if (!partner.ok) reject("not_authorized");
  const supabase = await createSupabaseServerClient();
  if (!supabase) reject("supabase_unavailable");
  const { data, error } = await supabase.rpc("partner_inventory_publish_atomic", {
    p_scope_type: scopeType,
    p_parent_id: scopeId,
    p_date: date,
    p_time: time || null,
    p_capacity: capacity,
    p_price_override: price,
    p_request_id: requestId
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data) || (data as Record<string, unknown>).ok !== true) {
    reject("publish_rejected");
  }
  revalidatePath(returnTo);
  revalidatePath("/stays");
  revalidatePath("/tours");
  redirect(`${returnTo}?inventory=success`);
}

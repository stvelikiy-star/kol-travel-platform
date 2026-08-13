import { createAuthError, createOwnershipError } from "@/lib/auth/errors";
import { requireClient, requireCourier, requirePartner } from "@/lib/auth/roles";
import type { AuthHelperResult, AuthProfile, OwnershipCheckResult } from "@/lib/auth/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function validateTargetId(targetId: string): AuthHelperResult<string> {
  if (!targetId || typeof targetId !== "string" || targetId.trim().length === 0) {
    return { ok: false, error: createAuthError("invalid_target", "Invalid target id.") };
  }

  return { ok: true, data: targetId.trim() };
}

function owned(profile: AuthProfile, targetId: string, ownerId: string): OwnershipCheckResult {
  return {
    ok: true,
    data: { userId: profile.userId, role: profile.role, targetId, ownerId }
  };
}

async function hasPartnerOwnedRow(table: string, targetId: string, businessId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("id", targetId)
    .eq("business_id", businessId)
    .maybeSingle();

  return !error && Boolean(data);
}

async function requirePartnerTargetOwnership(targetId: string, tables: string[]): Promise<OwnershipCheckResult> {
  const validTarget = validateTargetId(targetId);
  if (!validTarget.ok) return { ok: false, error: validTarget.error };

  const profile = await requirePartner();
  if (!profile.ok) return profile;
  if (!profile.data.partnerId) return { ok: false, error: createOwnershipError() };

  for (const table of tables) {
    if (await hasPartnerOwnedRow(table, validTarget.data, profile.data.partnerId)) {
      return owned(profile.data, validTarget.data, profile.data.partnerId);
    }
  }

  return { ok: false, error: createOwnershipError() };
}

async function requireClientTargetOwnership(targetId: string, table: "orders" | "bookings"): Promise<OwnershipCheckResult> {
  const validTarget = validateTargetId(targetId);
  if (!validTarget.ok) return { ok: false, error: validTarget.error };

  const profile = await requireClient();
  if (!profile.ok) return profile;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: createOwnershipError() };

  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("id", validTarget.data)
    .eq("client_id", profile.data.userId)
    .maybeSingle();

  if (error || !data) return { ok: false, error: createOwnershipError() };
  return owned(profile.data, validTarget.data, profile.data.userId);
}

export function requirePartnerOrderOwnership(orderId: string) {
  return requirePartnerTargetOwnership(orderId, ["orders"]);
}

export function requirePartnerBookingOwnership(bookingId: string) {
  return requirePartnerTargetOwnership(bookingId, ["bookings"]);
}

export function requirePartnerCatalogOwnership(itemId: string) {
  return requirePartnerTargetOwnership(itemId, ["menu_items", "products", "stays", "tours"]);
}

export function requirePartnerAvailabilityOwnership(scopeId: string) {
  // Existing availability surfaces ultimately belong to a partner business.
  // Direct business-owned parents are checked here; slot/row-specific checks
  // remain fail-closed until their existing table contract is invoked explicitly.
  return requirePartnerTargetOwnership(scopeId, ["rooms", "stays", "tours"]);
}

export async function requireCourierDeliveryAccess(deliveryId: string): Promise<OwnershipCheckResult> {
  const validTarget = validateTargetId(deliveryId);
  if (!validTarget.ok) return { ok: false, error: validTarget.error };

  const profile = await requireCourier();
  if (!profile.ok) return profile;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: createOwnershipError() };

  // Keep the existing canonical helper contract: courier_assignments controls
  // assignment access. Do not silently switch to deliveries.assigned_courier_id.
  const { data, error } = await supabase
    .from("courier_assignments")
    .select("delivery_id")
    .eq("delivery_id", validTarget.data)
    .eq("courier_id", profile.data.userId)
    .in("status", ["assigned", "accepted", "active"])
    .maybeSingle();

  if (error || !data) return { ok: false, error: createOwnershipError() };
  return owned(profile.data, validTarget.data, profile.data.userId);
}

export function requireClientOrderOwnership(orderId: string) {
  return requireClientTargetOwnership(orderId, "orders");
}

export function requireClientBookingOwnership(bookingId: string) {
  return requireClientTargetOwnership(bookingId, "bookings");
}

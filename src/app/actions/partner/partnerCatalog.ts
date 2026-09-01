"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePartner } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CatalogItemType = "menu_item" | "product";
type CatalogAction = "pause" | "resume" | "out_of_stock";

const itemTypes = new Set<CatalogItemType>(["menu_item", "product"]);
const actions = new Set<CatalogAction>(["pause", "resume", "out_of_stock"]);

function finish(state: "success" | "error", itemType: string, itemId: string, action: string, code?: string): never {
  const domain = itemType === "menu_item" ? "food" : "products";
  const params = new URLSearchParams({ catalogAction: state, action });
  if (code) params.set("code", code);
  redirect(`/partner/catalog/${domain}/${encodeURIComponent(itemId)}?${params.toString()}`);
}

export async function partnerCatalogAvailabilityFormAction(formData: FormData): Promise<never> {
  const itemType = String(formData.get("itemType") ?? "") as CatalogItemType;
  const itemId = String(formData.get("itemId") ?? "").trim();
  const action = String(formData.get("action") ?? "") as CatalogAction;
  const requestId = String(formData.get("requestId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!itemTypes.has(itemType)) finish("error", itemType, itemId, action, "invalid_item_type");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(itemId)) {
    finish("error", itemType, itemId || "invalid", action, "invalid_item_id");
  }
  if (!actions.has(action)) finish("error", itemType, itemId, action, "invalid_action");
  if (requestId.length < 8 || requestId.length > 128) finish("error", itemType, itemId, action, "invalid_request_id");
  if (reason.length > 500) finish("error", itemType, itemId, action, "reason_too_long");
  if (action !== "resume" && reason.length < 3) finish("error", itemType, itemId, action, "reason_required");

  const partner = await requirePartner();
  if (!partner.ok || !partner.data.partnerId) finish("error", itemType, itemId, action, "not_authorized");
  if (!( ["partner_owner", "partner_manager"] as string[]).includes(partner.data.role)) {
    finish("error", itemType, itemId, action, "manager_role_required");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) finish("error", itemType, itemId, action, "supabase_not_configured");

  const { data, error } = await supabase.rpc("partner_catalog_availability_action", {
    p_item_type: itemType,
    p_item_id: itemId,
    p_action: action,
    p_request_id: requestId,
    p_reason: reason || null
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    finish("error", itemType, itemId, action, "action_rejected");
  }
  if ((data as Record<string, unknown>).ok !== true) finish("error", itemType, itemId, action, "action_not_applied");

  const domain = itemType === "menu_item" ? "food" : "products";
  revalidatePath(`/partner/catalog/${domain}`);
  revalidatePath(`/partner/catalog/${domain}/${itemId}`);
  revalidatePath("/checkout");
  finish("success", itemType, itemId, action);
}

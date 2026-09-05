"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePartner } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PartnerCatalogDomain } from "@/lib/types/partner-catalog";

export type PartnerCatalogWriteAction = "create" | "update" | "submit";

const domains = new Set<PartnerCatalogDomain>(["food", "tours", "stays", "products"]);
const actions = new Set<PartnerCatalogWriteAction>(["create", "update", "submit"]);

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function finish(
  domain: string,
  state: "success" | "error",
  action: string,
  itemId?: string,
  code?: string
): never {
  const safeDomain = domains.has(domain as PartnerCatalogDomain) ? domain : "food";
  const params = new URLSearchParams({ partnerCatalogWrite: state, action });
  if (itemId) params.set("itemId", itemId);
  if (code) params.set("code", code);
  redirect(`/partner/catalog/${safeDomain}?${params.toString()}`);
}

function fieldsFromForm(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    category_id: String(formData.get("categoryId") ?? "").trim(),
    price: String(formData.get("price") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim(),
    location: String(formData.get("location") ?? "").trim(),
    duration: String(formData.get("duration") ?? "").trim(),
    type: String(formData.get("type") ?? "").trim(),
    preparation_time_minutes: String(formData.get("preparationTimeMinutes") ?? "").trim(),
    stock_qty: String(formData.get("stockQty") ?? "").trim()
  };
}

export async function partnerCatalogWriteFormAction(formData: FormData): Promise<never> {
  const domain = String(formData.get("domain") ?? "") as PartnerCatalogDomain;
  const action = String(formData.get("action") ?? "") as PartnerCatalogWriteAction;
  const itemId = String(formData.get("itemId") ?? "").trim();
  const requestId = String(formData.get("requestId") ?? "").trim();

  if (!domains.has(domain)) return finish(domain, "error", action || "unknown", itemId, "invalid_domain");
  if (!actions.has(action)) return finish(domain, "error", action || "unknown", itemId, "invalid_action");
  if (requestId.length < 8 || requestId.length > 128) return finish(domain, "error", action, itemId, "invalid_request_id");
  if (action === "create" && itemId) return finish(domain, "error", action, itemId, "create_item_id_must_be_empty");
  if (action !== "create" && !isUuid(itemId)) return finish(domain, "error", action, itemId, "invalid_item_id");

  const partner = await requirePartner();
  if (!partner.ok || !partner.data.partnerId) return finish(domain, "error", action, itemId, "not_authorized");
  if (!(["partner_owner", "partner_manager"] as string[]).includes(partner.data.role)) {
    return finish(domain, "error", action, itemId, "manager_role_required");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return finish(domain, "error", action, itemId, "supabase_not_configured");

  const fields = action === "submit" ? {} : fieldsFromForm(formData);
  const { data, error } = await supabase.rpc("partner_catalog_write_atomic", {
    p_domain: domain,
    p_action: action,
    p_item_id: action === "create" ? null : itemId,
    p_request_id: requestId,
    p_fields: fields
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return finish(domain, "error", action, itemId, "catalog_write_rejected");
  }

  const result = data as Record<string, unknown>;
  if (result.ok !== true || typeof result.item_id !== "string") {
    return finish(domain, "error", action, itemId, "catalog_write_not_applied");
  }

  const resultItemId = result.item_id;
  revalidatePath("/partner/catalog");
  revalidatePath(`/partner/catalog/${domain}`);
  revalidatePath(`/partner/catalog/${domain}/${resultItemId}`);
  revalidatePath("/admin/catalog");
  revalidatePath("/admin/catalog/review");

  return finish(domain, "success", action, resultItemId);
}

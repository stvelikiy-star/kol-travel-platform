"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminCatalogGovernanceAction = "publish" | "unpublish" | "archive";
export type AdminCatalogGovernanceDomain = "food" | "tours" | "stays" | "products";

const allowedActions = new Set<AdminCatalogGovernanceAction>(["publish", "unpublish", "archive"]);
const allowedDomains = new Set<AdminCatalogGovernanceDomain>(["food", "tours", "stays", "products"]);

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
function isAction(value: string): value is AdminCatalogGovernanceAction {
  return allowedActions.has(value as AdminCatalogGovernanceAction);
}
function isDomain(value: string): value is AdminCatalogGovernanceDomain {
  return allowedDomains.has(value as AdminCatalogGovernanceDomain);
}
function actionRedirect(
  domain: string,
  state: "success" | "error",
  action: string,
  code?: string
): never {
  const safeDomain = isDomain(domain) ? domain : "food";
  const params = new URLSearchParams({ adminCatalogGovernance: state, action });
  if (code) params.set("code", code);
  redirect(`/admin/catalog/${safeDomain}?${params.toString()}`);
}

export async function adminCatalogGovernanceFormAction(formData: FormData): Promise<never> {
  const itemId = String(formData.get("itemId") ?? "");
  const domain = String(formData.get("domain") ?? "");
  const action = String(formData.get("action") ?? "");
  const requestId = String(formData.get("requestId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!isUuid(itemId)) return actionRedirect(domain, "error", action || "unknown", "invalid_item_id");
  if (!isDomain(domain)) return actionRedirect(domain, "error", action || "unknown", "invalid_domain");
  if (!isAction(action)) return actionRedirect(domain, "error", action || "unknown", "invalid_action");
  if (requestId.length < 8 || requestId.length > 128) {
    return actionRedirect(domain, "error", action, "invalid_request_id");
  }
  if (reason.length < 3 || reason.length > 500) {
    return actionRedirect(domain, "error", action, "governance_reason_required");
  }

  const actor = await requireSuperAdmin();
  if (!actor.ok) return actionRedirect(domain, "error", action, "not_authorized");

  const supabase = await createSupabaseServerClient();
  if (!supabase) return actionRedirect(domain, "error", action, "supabase_not_configured");

  const { data, error } = await supabase.rpc("admin_catalog_governance_atomic", {
    p_item_id: itemId,
    p_domain: domain,
    p_action: action,
    p_request_id: requestId,
    p_reason: reason
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return actionRedirect(domain, "error", action, "governance_rejected");
  }
  const result = data as Record<string, unknown>;
  if (result.ok !== true) return actionRedirect(domain, "error", action, "governance_not_applied");

  revalidatePath("/admin/catalog");
  revalidatePath("/admin/catalog/review");
  revalidatePath(`/admin/catalog/${domain}`);
  revalidatePath("/food");
  revalidatePath("/tours");
  revalidatePath("/stays");
  revalidatePath("/shop");

  return actionRedirect(domain, "success", action);
}

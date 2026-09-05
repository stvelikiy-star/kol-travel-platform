"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminCatalogModerationAction = "approve" | "reject";
export type AdminCatalogModerationDomain = "food" | "tours" | "stays" | "products";

const allowedActions = new Set<AdminCatalogModerationAction>(["approve", "reject"]);
const allowedDomains = new Set<AdminCatalogModerationDomain>(["food", "tours", "stays", "products"]);

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isAction(value: string): value is AdminCatalogModerationAction {
  return allowedActions.has(value as AdminCatalogModerationAction);
}

function isDomain(value: string): value is AdminCatalogModerationDomain {
  return allowedDomains.has(value as AdminCatalogModerationDomain);
}

function actionRedirect(state: "success" | "error", action: string, code?: string): never {
  const params = new URLSearchParams({ adminCatalogAction: state, action });
  if (code) params.set("code", code);
  redirect(`/admin/catalog/review?${params.toString()}`);
}

export async function adminCatalogModerationFormAction(formData: FormData): Promise<never> {
  const itemId = String(formData.get("itemId") ?? "");
  const domain = String(formData.get("domain") ?? "");
  const action = String(formData.get("action") ?? "");
  const requestId = String(formData.get("requestId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!isUuid(itemId)) {
    return actionRedirect("error", action || "unknown", "invalid_item_id");
  }

  if (!isDomain(domain)) {
    return actionRedirect("error", action || "unknown", "invalid_domain");
  }

  if (!isAction(action)) {
    return actionRedirect("error", action || "unknown", "invalid_action");
  }

  if (requestId.length < 8 || requestId.length > 128) {
    return actionRedirect("error", action, "invalid_request_id");
  }

  if (reason.length < 3 || reason.length > 500) {
    return actionRedirect("error", action, "moderation_reason_required");
  }

  const actor = await requireSuperAdmin();
  if (!actor.ok) {
    return actionRedirect("error", action, "not_authorized");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return actionRedirect("error", action, "supabase_not_configured");
  }

  const { data, error } = await supabase.rpc("admin_catalog_moderation_atomic", {
    p_item_id: itemId,
    p_domain: domain,
    p_action: action,
    p_request_id: requestId,
    p_reason: reason
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return actionRedirect("error", action, "moderation_rejected");
  }

  const result = data as Record<string, unknown>;
  if (result.ok !== true) {
    return actionRedirect("error", action, "moderation_not_applied");
  }

  revalidatePath("/admin/catalog");
  revalidatePath("/admin/catalog/review");
  revalidatePath(`/admin/catalog/${domain}`);
  revalidatePath("/food");
  revalidatePath("/tours");
  revalidatePath("/stays");
  revalidatePath("/shop");

  return actionRedirect("success", action);
}

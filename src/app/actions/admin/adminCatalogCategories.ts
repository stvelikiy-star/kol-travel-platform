"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CategoryAction = "create" | "update" | "archive";
const allowedActions = new Set<CategoryAction>(["create", "update", "archive"]);
const allowedScopes = new Set(["food", "tour", "stay", "shop"]);

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
function isAction(value: string): value is CategoryAction {
  return allowedActions.has(value as CategoryAction);
}
function actionRedirect(state: "success" | "error", action: string, code?: string): never {
  const params = new URLSearchParams({ adminCategoryAction: state, action });
  if (code) params.set("code", code);
  redirect(`/admin/catalog/categories?${params.toString()}`);
}

export async function adminCatalogCategoryFormAction(formData: FormData): Promise<never> {
  const action = String(formData.get("action") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const requestId = String(formData.get("requestId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const scope = String(formData.get("scope") ?? "").trim().toLowerCase();
  const parentId = String(formData.get("parentId") ?? "").trim();
  const sortOrder = String(formData.get("sortOrder") ?? "0").trim();

  if (!isAction(action)) return actionRedirect("error", action || "unknown", "invalid_action");
  if (action !== "create" && !isUuid(categoryId)) {
    return actionRedirect("error", action, "invalid_category_id");
  }
  if (action === "create" && categoryId) return actionRedirect("error", action, "create_category_id_must_be_empty");
  if (requestId.length < 8 || requestId.length > 128) {
    return actionRedirect("error", action, "invalid_request_id");
  }
  if (reason.length < 3 || reason.length > 500) {
    return actionRedirect("error", action, "category_reason_required");
  }

  const fields: Record<string, string> = {};
  if (action !== "archive") {
    if (title.length < 2 || title.length > 120) return actionRedirect("error", action, "invalid_title");
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return actionRedirect("error", action, "invalid_slug");
    if (!allowedScopes.has(scope)) return actionRedirect("error", action, "invalid_scope");
    if (parentId && !isUuid(parentId)) return actionRedirect("error", action, "invalid_parent_id");
    if (!/^-?\d+$/.test(sortOrder)) return actionRedirect("error", action, "invalid_sort_order");
    fields.title = title;
    fields.slug = slug;
    fields.scope = scope;
    fields.parent_id = parentId;
    fields.sort_order = sortOrder;
  }

  const actor = await requireSuperAdmin();
  if (!actor.ok) return actionRedirect("error", action, "not_authorized");

  const supabase = await createSupabaseServerClient();
  if (!supabase) return actionRedirect("error", action, "supabase_not_configured");

  const { data, error } = await supabase.rpc("admin_catalog_category_atomic", {
    p_category_id: action === "create" ? null : categoryId,
    p_action: action,
    p_request_id: requestId,
    p_fields: fields,
    p_reason: reason
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return actionRedirect("error", action, "category_governance_rejected");
  }
  const result = data as Record<string, unknown>;
  if (result.ok !== true) return actionRedirect("error", action, "category_governance_not_applied");

  revalidatePath("/admin/catalog");
  revalidatePath("/admin/catalog/categories");
  revalidatePath("/admin/catalog/food");
  revalidatePath("/admin/catalog/tours");
  revalidatePath("/admin/catalog/stays");
  revalidatePath("/admin/catalog/products");
  revalidatePath("/food");
  revalidatePath("/tours");
  revalidatePath("/stays");
  revalidatePath("/shop");

  return actionRedirect("success", action);
}

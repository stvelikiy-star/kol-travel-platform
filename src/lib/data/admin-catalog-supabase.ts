import { requireAdmin } from "@/lib/auth/roles";
import { getCatalogSafetyFlags } from "@/lib/data/catalog-safety";
import { fetchSupabaseJson, toIsoText, toNumber, toText } from "@/lib/data/catalog-read-utils";
import { getAuthenticatedRestConfig } from "@/lib/data/authenticated-read-utils";
import { createAdminCatalogCounts, normalizeAdminCatalogStatus } from "@/lib/data/admin-catalog-mock";
import type {
  AdminCatalogCategoryView,
  AdminCatalogDomain,
  AdminCatalogItem,
  AdminCatalogOverview,
  AdminCatalogReadResult,
  AdminCatalogSafetyFlag
} from "@/lib/types/admin-catalog";

type CatalogRow = {
  business_id?: string | null;
  categories?: { title?: string | null } | null;
  category_id?: string | null;
  created_at?: string | null;
  currency?: string | null;
  description?: string | null;
  duration?: string | null;
  id: string;
  location?: string | null;
  metadata?: Record<string, unknown> | null;
  partners?: { title?: string | null } | null;
  price?: number | string | null;
  price_from?: number | string | null;
  status?: string | null;
  stock_qty?: number | string | null;
  title: string;
  type?: string | null;
  updated_at?: string | null;
};

type CategoryRow = {
  created_at?: string | null;
  id: string;
  parent_id?: string | null;
  scope?: string | null;
  slug?: string | null;
  sort_order?: number | string | null;
  title: string;
  updated_at?: string | null;
};

type AdminRoleResolution = {
  adminResolved: boolean;
  adminUserId?: string;
  diagnosticCode: AdminCatalogReadResult["mode"];
  fallbackAllowed: boolean;
  safeMessage: string;
  status: AdminCatalogReadResult["mode"];
};

function createAdminSupabaseError<T extends AdminCatalogItem[] | AdminCatalogCategoryView[] | AdminCatalogSafetyFlag[]>(
  code: AdminCatalogReadResult["mode"],
  message: string
): AdminCatalogReadResult<T> {
  return {
    counts: createAdminCatalogCounts([]),
    errorSafeMessage: message,
    fallbackUsed: false,
    items: [] as unknown as T,
    mode: code,
    ok: false,
    source: "supabase"
  };
}

async function resolveAdminRole(): Promise<AdminRoleResolution> {
  const [config, admin] = await Promise.all([getAuthenticatedRestConfig(), requireAdmin()]);

  if (!config) {
    return {
      adminResolved: false,
      diagnosticCode: "admin_auth_missing",
      fallbackAllowed: true,
      safeMessage: "Authenticated Supabase admin session is not available.",
      status: "admin_auth_missing"
    };
  }

  if (!admin.ok) {
    return {
      adminResolved: false,
      diagnosticCode: "admin_role_missing",
      fallbackAllowed: true,
      safeMessage: "Admin role is not available for this session.",
      status: "admin_role_missing"
    };
  }

  return {
    adminResolved: true,
    adminUserId: admin.data.userId,
    diagnosticCode: "supabase_success",
    fallbackAllowed: false,
    safeMessage: "Admin role resolved for scoped catalog reads.",
    status: "supabase_success"
  };
}

function mapRow(row: CatalogRow, domain: AdminCatalogDomain): AdminCatalogItem {
  const price = domain === "stays" ? toNumber(row.price_from) : toNumber(row.price);
  const category = row.categories?.title ?? domain;
  const safetyFlags = getCatalogSafetyFlags({
    category,
    description: row.description,
    metadata: row.metadata,
    price,
    status: row.status,
    title: row.title
  });

  return {
    businessId: row.business_id ?? undefined,
    businessTitle: row.partners?.title ?? "Business",
    category,
    currency: "KGS",
    description: toText(row.description, "No description"),
    domain,
    id: row.id,
    location: row.location ?? undefined,
    metadata: row.metadata ?? null,
    price,
    safetyFlags,
    status: normalizeAdminCatalogStatus(row.status, safetyFlags.length > 0),
    stockQty: domain === "products" ? toNumber(row.stock_qty) : undefined,
    title: row.title,
    type: row.duration ?? row.type ?? undefined,
    updatedAt: toIsoText(row.updated_at ?? row.created_at)
  };
}

async function readDomain(table: string, domain: AdminCatalogDomain): Promise<AdminCatalogReadResult> {
  const config = await getAuthenticatedRestConfig();

  if (!config) {
    return createAdminSupabaseError("admin_auth_missing", "Supabase read environment is not configured.");
  }

  const role = await resolveAdminRole();

  if (!role.adminResolved) {
    return createAdminSupabaseError(role.status, role.safeMessage);
  }

  const url = new URL(`${config.restUrl}/${table}`);
  url.searchParams.set("select", "id,business_id,category_id,title,description,location,price,price_from,currency,duration,type,status,stock_qty,metadata,created_at,updated_at,categories(title),partners(title)");
  url.searchParams.set("order", "updated_at.desc");

  try {
    const response = await fetchSupabaseJson<CatalogRow>(url, config.apiKey, config.accessToken);

    if (!response.ok) {
      return createAdminSupabaseError("read_failed", "Admin catalog could not be read safely.");
    }

    const items = response.rows.map((row) => mapRow(row, domain));

    if (items.length === 0) {
      return createAdminSupabaseError("empty_result", "No admin catalog records were found.");
    }

    return {
      counts: createAdminCatalogCounts(items),
      fallbackUsed: false,
      items,
      mode: "supabase_success",
      ok: true,
      source: "supabase"
    };
  } catch {
    return createAdminSupabaseError("server_error", "Admin catalog read failed safely.");
  }
}

export function getAdminFoodCatalogFromSupabase() {
  return readDomain("menu_items", "food");
}

export function getAdminToursCatalogFromSupabase() {
  return readDomain("tours", "tours");
}

export function getAdminStaysCatalogFromSupabase() {
  return readDomain("stays", "stays");
}

export function getAdminProductsCatalogFromSupabase() {
  return readDomain("products", "products");
}

export async function getAdminCategoriesFromSupabase(): Promise<AdminCatalogReadResult<AdminCatalogCategoryView[]>> {
  const config = await getAuthenticatedRestConfig();

  if (!config) {
    return createAdminSupabaseError("admin_auth_missing", "Supabase read environment is not configured.");
  }

  const role = await resolveAdminRole();

  if (!role.adminResolved) {
    return createAdminSupabaseError(role.status, role.safeMessage);
  }

  const url = new URL(`${config.restUrl}/categories`);
  url.searchParams.set("select", "id,title,slug,scope,parent_id,sort_order,created_at,updated_at");
  url.searchParams.set("order", "sort_order.asc");

  try {
    const response = await fetchSupabaseJson<CategoryRow>(url, config.apiKey, config.accessToken);

    if (!response.ok) {
      return createAdminSupabaseError("read_failed", "Categories could not be read safely.");
    }

    const items = response.rows.map((row) => ({
      createdAt: row.created_at ?? undefined,
      id: row.id,
      parentId: row.parent_id ?? null,
      scope: row.scope ?? null,
      slug: row.slug ?? null,
      sortOrder: typeof row.sort_order === "string" ? Number(row.sort_order) : row.sort_order ?? null,
      title: row.title,
      updatedAt: row.updated_at ?? undefined
    }));

    return {
      counts: createAdminCatalogCounts([]),
      fallbackUsed: false,
      items,
      mode: "supabase_success",
      ok: true,
      source: "supabase"
    };
  } catch {
    return createAdminSupabaseError("server_error", "Categories read failed safely.");
  }
}

export async function getAdminCatalogReviewQueueFromSupabase(): Promise<AdminCatalogReadResult<AdminCatalogItem[]>> {
  const results = await Promise.all([
    getAdminFoodCatalogFromSupabase(),
    getAdminToursCatalogFromSupabase(),
    getAdminStaysCatalogFromSupabase(),
    getAdminProductsCatalogFromSupabase()
  ]);
  const items = results.flatMap((result) => result.ok ? (result.items as AdminCatalogItem[]) : []);
  const queue = items.filter((item) => item.status === "under_review" || (item.safetyFlags?.length ?? 0) > 0);

  return {
    counts: createAdminCatalogCounts(queue),
    fallbackUsed: false,
    items: queue,
    mode: "supabase_success",
    ok: true,
    source: "supabase" as const
  };
}

export async function getAdminCatalogSafetyFromSupabase(): Promise<AdminCatalogReadResult<AdminCatalogSafetyFlag[]>> {
  const products = await getAdminProductsCatalogFromSupabase();
  const productItems = products.ok ? (products.items as AdminCatalogItem[]) : [];
  const flags: AdminCatalogSafetyFlag[] = productItems.flatMap((item) =>
    (item.safetyFlags ?? []).map((flag) => ({
      businessId: item.businessId,
      businessTitle: item.businessTitle,
      domain: item.domain,
      itemId: item.id,
      reason: flag,
      severity: flag === "alcohol_keyword_match" ? "critical" : "medium",
      status: item.status,
      title: item.title
    }))
  );

  return {
    counts: createAdminCatalogCounts(productItems),
    fallbackUsed: false,
    items: flags,
    mode: "supabase_success",
    ok: true,
    source: "supabase"
  };
}

export async function getAdminCatalogOverviewFromSupabase(): Promise<AdminCatalogReadResult<AdminCatalogOverview>> {
  const results = await Promise.all([
    getAdminFoodCatalogFromSupabase(),
    getAdminToursCatalogFromSupabase(),
    getAdminStaysCatalogFromSupabase(),
    getAdminProductsCatalogFromSupabase()
  ]);
  const allItems = results.flatMap((result) => result.ok ? (result.items as AdminCatalogItem[]) : []);
  const safety = allItems.filter((item) => (item.safetyFlags?.length ?? 0) > 0);
  const overview: AdminCatalogOverview = {
    counts: createAdminCatalogCounts(allItems),
    domains: [
      { counts: results[0].counts, domain: "food", href: "/admin/catalog/food", label: "Food" },
      { counts: results[1].counts, domain: "tours", href: "/admin/catalog/tours", label: "Tours" },
      { counts: results[2].counts, domain: "stays", href: "/admin/catalog/stays", label: "Stays" },
      { counts: results[3].counts, domain: "products", href: "/admin/catalog/products", label: "Products" },
      { counts: createAdminCatalogCounts([]), domain: "categories", href: "/admin/catalog/categories", label: "Categories" }
    ],
    reviewCount: allItems.filter((item) => item.status === "under_review").length,
    safetyFlagCount: safety.length
  };

  return {
    counts: overview.counts,
    fallbackUsed: false,
    items: overview,
    mode: "supabase_success",
    ok: true,
    source: "supabase"
  };
}

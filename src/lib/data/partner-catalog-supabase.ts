import { requirePartner } from "@/lib/auth/roles";
import { getCatalogSafetyFlags } from "@/lib/data/catalog-safety";
import { fetchSupabaseJson, toIsoText, toNumber, toText } from "@/lib/data/catalog-read-utils";
import { getAuthenticatedRestConfig } from "@/lib/data/authenticated-read-utils";
import {
  createPartnerCatalogCounts,
  normalizePartnerCatalogStatus
} from "@/lib/data/partner-catalog-mock";
import type {
  PartnerBusinessContext,
  PartnerCatalogCategory,
  PartnerCatalogDomain,
  PartnerCatalogItem,
  PartnerCatalogOverview,
  PartnerCatalogReadResult
} from "@/lib/types/partner-catalog";

type CatalogRow = {
  business_id: string;
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
  slug?: string | null;
  status?: string | null;
  stock_qty?: number | string | null;
  title: string;
  type?: string | null;
  updated_at?: string | null;
};

type PartnerBusinessRow = {
  business_status?: string | null;
  id: string;
  status?: string | null;
  title?: string | null;
};

type CatalogAvailabilityRow = {
  availability_state: "available" | "paused" | "out_of_stock";
  item_id: string;
  item_type: "menu_item" | "product";
  reason?: string | null;
};

type PartnerOwnershipResolution = {
  business?: PartnerBusinessContext;
  diagnosticCode: PartnerCatalogReadResult["mode"];
  ownershipResolved: boolean;
  safeMessage: string;
  status: PartnerCatalogReadResult["mode"];
};

function createPartnerSupabaseError(code: PartnerCatalogReadResult["mode"], message: string): PartnerCatalogReadResult {
  return {
    business: {
      businessId: "",
      businessTitle: "Partner business unavailable",
      ownershipResolved: false
    },
    code,
    counts: createPartnerCatalogCounts([]),
    errorSafeMessage: message,
    fallbackUsed: false,
    items: [],
    mode: code,
    ok: false,
    source: "supabase"
  };
}

function isInactiveBusiness(row: PartnerBusinessRow) {
  const values = [row.status, row.business_status].filter(Boolean);
  return values.some((value) => ["inactive", "suspended", "blocked", "disabled"].includes(String(value)));
}

async function resolvePartnerOwnership(): Promise<PartnerOwnershipResolution> {
  const [config, partner] = await Promise.all([getAuthenticatedRestConfig(), requirePartner()]);

  if (!config || !partner.ok || !partner.data.partnerId) {
    return {
      diagnosticCode: "auth_missing",
      ownershipResolved: false,
      safeMessage: "Supabase read environment is not configured.",
      status: "auth_missing"
    };
  }

  const url = new URL(`${config.restUrl}/partners`);
  url.searchParams.set("select", "id,title,status,business_status");
  url.searchParams.set("id", `eq.${partner.data.partnerId}`);
  url.searchParams.set("limit", "1");

  try {
    const response = await fetchSupabaseJson<PartnerBusinessRow>(url, config.apiKey, config.accessToken);
    const row = response.rows[0];

    if (!response.ok) {
      return {
        diagnosticCode: "read_failed",
        ownershipResolved: false,
        safeMessage: "Partner business context could not be read safely.",
        status: "read_failed"
      };
    }

    if (!row) {
      return {
        diagnosticCode: "business_missing",
        ownershipResolved: false,
        safeMessage: "Partner business context was not found.",
        status: "business_missing"
      };
    }

    if (isInactiveBusiness(row)) {
      return {
        diagnosticCode: "business_inactive",
        ownershipResolved: false,
        safeMessage: "Partner business is not active for catalog reads.",
        status: "business_inactive"
      };
    }

    return {
      business: {
        businessId: row.id,
        businessTitle: row.title ?? "Partner business",
        ownershipResolved: true
      },
      diagnosticCode: "supabase_success",
      ownershipResolved: true,
      safeMessage: "Partner business context resolved for catalog access.",
      status: "supabase_success"
    };
  } catch {
    return {
      diagnosticCode: "server_error",
      ownershipResolved: false,
      safeMessage: "Partner ownership resolution failed safely.",
      status: "server_error"
    };
  }
}

function mapRow(
  row: CatalogRow,
  domain: PartnerCatalogDomain,
  business: PartnerBusinessContext,
  availability?: CatalogAvailabilityRow
): PartnerCatalogItem {
  const price = domain === "stays" ? toNumber(row.price_from) : toNumber(row.price);
  const category = row.categories?.title ?? domain;
  const safetyFlags = domain === "products"
    ? getCatalogSafetyFlags({
        category,
        description: row.description,
        metadata: row.metadata,
        price,
        status: row.status,
        title: row.title
      })
    : [];

  return {
    businessId: row.business_id,
    businessTitle: row.partners?.title ?? business.businessTitle,
    category,
    categoryId: row.category_id ?? undefined,
    currency: "KGS",
    description: toText(row.description, "No description"),
    domain,
    id: row.id,
    location: row.location ?? undefined,
    metadata: row.metadata ?? null,
    operationalReason: availability?.reason ?? undefined,
    operationalStatus: domain === "food" || domain === "products"
      ? availability?.availability_state ?? "available"
      : "not_applicable",
    price,
    safetyFlags,
    slug: row.slug ?? undefined,
    status: normalizePartnerCatalogStatus(row.status),
    stockQty: domain === "products" ? toNumber(row.stock_qty) : undefined,
    title: row.title,
    type: row.duration ?? row.type ?? undefined,
    updatedAt: toIsoText(row.updated_at ?? row.created_at)
  };
}

async function readDomain(table: string, domain: PartnerCatalogDomain): Promise<PartnerCatalogReadResult> {
  const config = await getAuthenticatedRestConfig();

  if (!config) {
    return createPartnerSupabaseError("auth_missing", "Supabase read environment is not configured.");
  }

  const ownership = await resolvePartnerOwnership();

  if (!ownership.ownershipResolved || !ownership.business) {
    return createPartnerSupabaseError(ownership.status, ownership.safeMessage);
  }

  const business = ownership.business;
  const url = new URL(`${config.restUrl}/${table}`);
  url.searchParams.set("select", "id,business_id,category_id,title,slug,description,location,price,price_from,currency,duration,type,status,stock_qty,metadata,created_at,updated_at,categories(title),partners(title)");
  url.searchParams.set("business_id", `eq.${business.businessId}`);
  url.searchParams.set("order", "updated_at.desc");

  try {
    const response = await fetchSupabaseJson<CatalogRow>(url, config.apiKey, config.accessToken);

    if (!response.ok) {
      return createPartnerSupabaseError("read_failed", "Partner catalog could not be read safely.");
    }

    const rows = response.rows.filter((row) => row.business_id === business.businessId);
    let availabilityByItem = new Map<string, CatalogAvailabilityRow>();

    if (domain === "food" || domain === "products") {
      const availabilityUrl = new URL(`${config.restUrl}/partner_catalog_item_availability`);
      availabilityUrl.searchParams.set("select", "item_id,item_type,availability_state,reason");
      availabilityUrl.searchParams.set("business_id", `eq.${business.businessId}`);
      availabilityUrl.searchParams.set("item_type", `eq.${domain === "food" ? "menu_item" : "product"}`);
      const availabilityResponse = await fetchSupabaseJson<CatalogAvailabilityRow>(
        availabilityUrl,
        config.apiKey,
        config.accessToken
      );
      if (!availabilityResponse.ok) {
        return createPartnerSupabaseError("read_failed", "Catalog availability could not be read safely.");
      }
      availabilityByItem = new Map(availabilityResponse.rows.map((entry) => [entry.item_id, entry]));
    }

    const items = rows.map((row) => mapRow(row, domain, business, availabilityByItem.get(row.id)));

    if (items.length === 0) {
      return {
        business,
        code: "empty_result",
        counts: createPartnerCatalogCounts([]),
        fallbackUsed: false,
        items: [],
        mode: "empty_result",
        ok: true,
        source: "supabase"
      };
    }

    return {
      business,
      counts: createPartnerCatalogCounts(items),
      fallbackUsed: false,
      items,
      mode: "supabase_success",
      ok: true,
      source: "supabase"
    };
  } catch {
    return createPartnerSupabaseError("server_error", "Partner catalog read failed safely.");
  }
}

export async function getPartnerCatalogCategoriesFromSupabase(domain: PartnerCatalogDomain): Promise<PartnerCatalogCategory[]> {
  const config = await getAuthenticatedRestConfig();
  if (!config) return [];
  const ownership = await resolvePartnerOwnership();
  if (!ownership.ownershipResolved) return [];

  const scope = domain === "food" ? "food" : domain === "tours" ? "tour" : domain === "stays" ? "stay" : "shop";
  const url = new URL(`${config.restUrl}/categories`);
  url.searchParams.set("select", "id,title,scope");
  url.searchParams.set("scope", `eq.${scope}`);
  url.searchParams.set("order", "title.asc");

  try {
    const response = await fetchSupabaseJson<PartnerCatalogCategory>(url, config.apiKey, config.accessToken);
    if (!response.ok) return [];
    return response.rows.filter((row) => row.scope === scope && Boolean(row.id) && Boolean(row.title));
  } catch {
    return [];
  }
}

export function getPartnerFoodCatalogFromSupabase() {
  return readDomain("menu_items", "food");
}

export function getPartnerToursCatalogFromSupabase() {
  return readDomain("tours", "tours");
}

export function getPartnerStaysCatalogFromSupabase() {
  return readDomain("stays", "stays");
}

export function getPartnerProductsCatalogFromSupabase() {
  return readDomain("products", "products");
}

export async function getPartnerCatalogOverviewFromSupabase(): Promise<PartnerCatalogReadResult<PartnerCatalogOverview>> {
  const results = await Promise.all([
    getPartnerFoodCatalogFromSupabase(),
    getPartnerToursCatalogFromSupabase(),
    getPartnerStaysCatalogFromSupabase(),
    getPartnerProductsCatalogFromSupabase()
  ]);

  const failedResult = results.find((result) => !result.ok);

  if (failedResult) {
    const emptyCounts = createPartnerCatalogCounts([]);
    const business = results.find((result) => result.business?.ownershipResolved)?.business ?? {
      businessId: "",
      businessTitle: "Partner business unavailable",
      ownershipResolved: false
    };

    return {
      business,
      code: failedResult.code ?? failedResult.mode,
      counts: emptyCounts,
      errorSafeMessage: failedResult.errorSafeMessage ?? "Partner catalog overview could not be read safely.",
      fallbackUsed: false,
      items: {
        business,
        counts: emptyCounts,
        domains: []
      },
      mode: failedResult.mode,
      ok: false,
      source: "supabase"
    };
  }

  const business = results[0].business ?? {
    businessId: "",
    businessTitle: "Partner business unavailable",
    ownershipResolved: false
  };
  const allItems = results.flatMap((result) => result.items as PartnerCatalogItem[]);
  const overview: PartnerCatalogOverview = {
    business,
    counts: createPartnerCatalogCounts(allItems),
    domains: [
      { counts: results[0].counts, domain: "food", href: "/partner/catalog/food", label: "Food" },
      { counts: results[1].counts, domain: "tours", href: "/partner/catalog/tours", label: "Tours" },
      { counts: results[2].counts, domain: "stays", href: "/partner/catalog/stays", label: "Stays" },
      { counts: results[3].counts, domain: "products", href: "/partner/catalog/products", label: "Products" }
    ]
  };

  return {
    business,
    counts: overview.counts,
    fallbackUsed: false,
    items: overview,
    mode: "supabase_success",
    ok: true,
    source: "supabase"
  };
}

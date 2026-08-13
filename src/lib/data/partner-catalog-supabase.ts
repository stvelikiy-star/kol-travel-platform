import { requirePartner } from "@/lib/auth/roles";
import { getCatalogSafetyFlags } from "@/lib/data/catalog-safety";
import { fetchSupabaseJson, toIsoText, toNumber, toText } from "@/lib/data/catalog-read-utils";
import { getAuthenticatedRestConfig } from "@/lib/data/authenticated-read-utils";
import {
  createMockPartnerCatalogResult,
  createPartnerCatalogCounts,
  getMockPartnerBusinessContext,
  normalizePartnerCatalogStatus
} from "@/lib/data/partner-catalog-mock";
import type {
  PartnerBusinessContext,
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

type PartnerOwnershipResolution = {
  business?: PartnerBusinessContext;
  diagnosticCode: PartnerCatalogReadResult["mode"];
  fallbackAllowed: boolean;
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
      fallbackAllowed: true,
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
        fallbackAllowed: true,
        ownershipResolved: false,
        safeMessage: "Partner business context could not be read safely.",
        status: "read_failed"
      };
    }

    if (!row) {
      return {
        diagnosticCode: "business_missing",
        fallbackAllowed: true,
        ownershipResolved: false,
        safeMessage: "Partner business context was not found.",
        status: "business_missing"
      };
    }

    if (isInactiveBusiness(row)) {
      return {
        diagnosticCode: "business_inactive",
        fallbackAllowed: true,
        ownershipResolved: false,
        safeMessage: "Partner business is not active for catalog reads.",
        status: "business_inactive"
      };
    }

    return {
      business: {
        businessId: row.id,
        businessTitle: row.title ?? "Demo partner business",
        ownershipResolved: true
      },
      diagnosticCode: "supabase_success",
      fallbackAllowed: false,
      ownershipResolved: true,
      safeMessage: "Partner business context resolved for read-only catalog access.",
      status: "supabase_success"
    };
  } catch {
    return {
      diagnosticCode: "server_error",
      fallbackAllowed: true,
      ownershipResolved: false,
      safeMessage: "Partner ownership resolution failed safely.",
      status: "server_error"
    };
  }
}

function mapRow(row: CatalogRow, domain: PartnerCatalogDomain, business: PartnerBusinessContext): PartnerCatalogItem {
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
    currency: "KGS",
    description: toText(row.description, "No description"),
    domain,
    id: row.id,
    location: row.location ?? undefined,
    metadata: row.metadata ?? null,
    price,
    safetyFlags,
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
  url.searchParams.set("select", "id,business_id,category_id,title,description,location,price,price_from,currency,duration,type,status,stock_qty,metadata,created_at,updated_at,categories(title),partners(title)");
  url.searchParams.set("business_id", `eq.${business.businessId}`);
  url.searchParams.set("order", "updated_at.desc");

  try {
    const response = await fetchSupabaseJson<CatalogRow>(url, config.apiKey, config.accessToken);

    if (!response.ok) {
      return createPartnerSupabaseError("read_failed", "Partner catalog could not be read safely.");
    }

    const rows = response.rows.filter((row) => row.business_id === business.businessId);
    const items = rows.map((row) => mapRow(row, domain, business));

    if (items.length === 0) {
      return createPartnerSupabaseError("empty_result", "No partner catalog records were found.");
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

  if (results.some((result) => !result.ok)) {
    const fallback = createMockPartnerCatalogResult([], "fallback", "fallback_to_mock");
    return {
      ...fallback,
      items: {
        business: getMockPartnerBusinessContext(),
        counts: fallback.counts,
        domains: []
      }
    };
  }

  const business = results[0]?.business ?? getMockPartnerBusinessContext();
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

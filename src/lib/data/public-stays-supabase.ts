import type { ProductStatus, Stay } from "@/types";
import type { PublicCatalogReadResult } from "@/lib/data/types";

const publicStayFields = [
  "id",
  "business_id",
  "category_id",
  "title",
  "slug",
  "type",
  "description",
  "location",
  "price_from",
  "currency",
  "status",
  "metadata",
  "created_at",
  "updated_at",
  "categories(title,slug,scope)",
  "partners(title,slug,type,status,business_status,rating)"
].join(",");

const publicCatalogReadTimeoutMs = 1500;

type SupabasePublicStayRow = {
  id: string;
  business_id: string;
  category_id: string | null;
  title: string;
  slug: string;
  type: string | null;
  description: string | null;
  location: string | null;
  price_from: number | string | null;
  currency: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  categories?: {
    title?: string | null;
    slug?: string | null;
    scope?: string | null;
  } | null;
  partners?: {
    title?: string | null;
    slug?: string | null;
    type?: string | null;
    status?: string | null;
    business_status?: string | null;
    rating?: number | string | null;
  } | null;
};

function createPublicStaysSupabaseResult(input: {
  ok: boolean;
  items?: Stay[];
  code?: PublicCatalogReadResult<Stay>["code"];
  message?: string;
}): PublicCatalogReadResult<Stay> {
  return {
    ok: input.ok,
    source: "supabase",
    items: input.items ?? [],
    code: input.code,
    message: input.message
  };
}

function getSupabaseReadConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !publicKey) {
    return null;
  }

  return {
    restUrl: `${url.replace(/\/$/, "")}/rest/v1`,
    publicKey
  };
}

function toNumber(value: number | string | null | undefined, fallback = 0) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function toProductStatus(value: string): ProductStatus {
  switch (value) {
    case "active":
    case "out_of_stock":
    case "hidden":
    case "stopped":
    case "under_review":
      return value;
    case "published":
      return "active";
    default:
      return "under_review";
  }
}

function toStayType(value: string | null): Stay["type"] {
  switch (value) {
    case "guest_house":
    case "hotel":
    case "cottage":
    case "yurt_camp":
    case "villa":
      return value;
    default:
      return "guest_house";
  }
}

function toCurrency(value: string | null): Stay["currency"] {
  return value === "KGS" ? "KGS" : "KGS";
}

function mapPublicStay(row: SupabasePublicStayRow): Stay {
  return {
    id: row.id,
    businessId: row.business_id,
    title: row.title,
    slug: row.slug,
    type: toStayType(row.type),
    location: row.location ?? "Issyk-Kul",
    description: row.description ?? "",
    rating: toNumber(row.partners?.rating, 4.8),
    minPricePerNight: toNumber(row.price_from),
    currency: toCurrency(row.currency),
    status: toProductStatus(row.status)
  };
}

export async function getPublicStaysFromSupabase(): Promise<PublicCatalogReadResult<Stay>> {
  const config = getSupabaseReadConfig();

  if (!config) {
    return createPublicStaysSupabaseResult({
      ok: false,
      code: "supabase_not_configured",
      message: "Supabase read environment is not configured."
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), publicCatalogReadTimeoutMs);
    const url = new URL(`${config.restUrl}/stays`);
    url.searchParams.set("select", publicStayFields);
    url.searchParams.set("status", "in.(active,published)");
    url.searchParams.set("order", "created_at.desc");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        apikey: config.publicKey,
        accept: "application/json"
      },
      cache: "no-store",
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));

    if (response.status === 404) {
      return createPublicStaysSupabaseResult({
        ok: false,
        code: "table_missing",
        message: "Public stays table is not available."
      });
    }

    if (!response.ok) {
      return createPublicStaysSupabaseResult({
        ok: false,
        code: "read_failed",
        message: "Public stays could not be read safely."
      });
    }

    const rows = (await response.json()) as SupabasePublicStayRow[];
    const items = rows.map(mapPublicStay);

    if (items.length === 0) {
      return createPublicStaysSupabaseResult({
        ok: false,
        items,
        code: "empty_result",
        message: "No Supabase public stays were found."
      });
    }

    return createPublicStaysSupabaseResult({
      ok: true,
      items,
      message: "Public stays read from Supabase test data."
    });
  } catch {
    return createPublicStaysSupabaseResult({
      ok: false,
      code: "server_error",
      message: "Public stays read failed safely."
    });
  }
}

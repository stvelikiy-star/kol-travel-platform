import type { ProductStatus, Tour } from "@/types";
import type { PublicCatalogReadResult } from "@/lib/data/types";

const publicTourFields = [
  "id",
  "business_id",
  "category_id",
  "title",
  "slug",
  "description",
  "location",
  "price",
  "currency",
  "duration",
  "status",
  "metadata",
  "created_at",
  "updated_at",
  "categories(title,slug,scope)",
  "partners(title,slug,type,status,business_status,rating)"
].join(",");

const publicCatalogReadTimeoutMs = 5000;

type SupabasePublicTourRow = {
  id: string;
  business_id: string;
  category_id: string | null;
  title: string;
  slug: string;
  description: string | null;
  location: string | null;
  price: number | string | null;
  currency: string | null;
  duration: string | null;
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

function createPublicToursSupabaseResult(input: {
  ok: boolean;
  items?: Tour[];
  code?: PublicCatalogReadResult<Tour>["code"];
  message?: string;
}): PublicCatalogReadResult<Tour> {
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

function toCurrency(value: string | null): Tour["currency"] {
  return value === "KGS" ? "KGS" : "KGS";
}

function mapPublicTour(row: SupabasePublicTourRow): Tour {
  return {
    id: row.id,
    businessId: row.business_id,
    title: row.title,
    slug: row.slug,
    location: row.location ?? "Issyk-Kul",
    description: row.description ?? "",
    price: toNumber(row.price),
    currency: toCurrency(row.currency),
    duration: row.duration ?? row.categories?.title ?? "Tour",
    status: toProductStatus(row.status),
    rating: toNumber(row.partners?.rating, 4.8)
  };
}

export async function getPublicToursFromSupabase(): Promise<PublicCatalogReadResult<Tour>> {
  const config = getSupabaseReadConfig();

  if (!config) {
    return createPublicToursSupabaseResult({
      ok: false,
      code: "supabase_not_configured",
      message: "Supabase read environment is not configured."
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), publicCatalogReadTimeoutMs);
    const url = new URL(`${config.restUrl}/tours`);
    url.searchParams.set("select", publicTourFields);
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
      return createPublicToursSupabaseResult({
        ok: false,
        code: "table_missing",
        message: "Public tours table is not available."
      });
    }

    if (!response.ok) {
      return createPublicToursSupabaseResult({
        ok: false,
        code: "read_failed",
        message: "Public tours could not be read safely."
      });
    }

    const rows = (await response.json()) as SupabasePublicTourRow[];
    const items = rows.map(mapPublicTour);

    if (items.length === 0) {
      return createPublicToursSupabaseResult({
        ok: false,
        items,
        code: "empty_result",
        message: "No Supabase public tours were found."
      });
    }

    return createPublicToursSupabaseResult({
      ok: true,
      items,
      message: "Public tours read from Supabase test data."
    });
  } catch {
    return createPublicToursSupabaseResult({
      ok: false,
      code: "server_error",
      message: "Public tours read failed safely."
    });
  }
}

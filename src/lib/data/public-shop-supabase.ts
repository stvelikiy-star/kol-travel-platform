import type { Product, ProductStatus } from "@/types";
import type { PublicCatalogReadResult } from "@/lib/data/types";

const publicShopFields = [
  "id",
  "business_id",
  "category_id",
  "title",
  "description",
  "price",
  "stock_qty",
  "status",
  "metadata",
  "created_at",
  "updated_at",
  "categories(title,slug,scope)",
  "partners(title,slug,type,status,business_status,rating)"
].join(",");

const publicCatalogReadTimeoutMs = 1500;

const alcoholKeywords = [
  "alcohol",
  "beer",
  "wine",
  "vodka",
  "whisky",
  "whiskey",
  "champagne",
  "cognac",
  "liquor",
  "\u0441\u043f\u0438\u0440\u0442",
  "\u0430\u043b\u043a\u043e\u0433\u043e\u043b\u044c",
  "\u043f\u0438\u0432\u043e",
  "\u0432\u0438\u043d\u043e",
  "\u0432\u043e\u0434\u043a\u0430",
  "\u0432\u0438\u0441\u043a\u0438",
  "\u0448\u0430\u043c\u043f\u0430\u043d\u0441\u043a\u043e\u0435",
  "\u043a\u043e\u043d\u044c\u044f\u043a",
  "\u0430\u0440\u0430\u043a"
];

type PublicShopSupabaseResult = PublicCatalogReadResult<Product> & {
  safetyFiltered?: boolean;
};

type SupabasePublicShopProductRow = {
  id: string;
  business_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  price: number | string | null;
  stock_qty: number | string | null;
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

function createPublicShopSupabaseResult(input: {
  ok: boolean;
  items?: Product[];
  code?: PublicCatalogReadResult<Product>["code"];
  message?: string;
  safetyFiltered?: boolean;
}): PublicShopSupabaseResult {
  return {
    ok: input.ok,
    source: "supabase",
    items: input.items ?? [],
    code: input.code,
    message: input.message,
    safetyFiltered: input.safetyFiltered
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

function includesAlcoholKeyword(value: string) {
  const normalized = value.toLocaleLowerCase();
  return alcoholKeywords.some((keyword) => normalized.includes(keyword));
}

function metadataToSearchText(metadata: Record<string, unknown> | null) {
  if (!metadata) {
    return "";
  }

  try {
    return JSON.stringify(metadata);
  } catch {
    return "";
  }
}

function isAlcoholRelated(row: SupabasePublicShopProductRow) {
  const searchText = [
    row.title,
    row.description,
    row.categories?.title,
    row.categories?.slug,
    row.categories?.scope,
    metadataToSearchText(row.metadata)
  ]
    .filter(Boolean)
    .join(" ");

  return includesAlcoholKeyword(searchText);
}

function mapPublicShopProduct(row: SupabasePublicShopProductRow): Product {
  return {
    id: row.id,
    businessId: row.business_id,
    category: row.categories?.title ?? "Shop",
    title: row.title,
    description: row.description ?? "",
    price: toNumber(row.price),
    currency: "KGS",
    status: toProductStatus(row.status)
  };
}

export async function getPublicShopProductsFromSupabase(): Promise<PublicShopSupabaseResult> {
  const config = getSupabaseReadConfig();

  if (!config) {
    return createPublicShopSupabaseResult({
      ok: false,
      code: "supabase_not_configured",
      message: "Supabase read environment is not configured."
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), publicCatalogReadTimeoutMs);
    const url = new URL(`${config.restUrl}/products`);
    url.searchParams.set("select", publicShopFields);
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
      return createPublicShopSupabaseResult({
        ok: false,
        code: "table_missing",
        message: "Public products table is not available."
      });
    }

    if (!response.ok) {
      return createPublicShopSupabaseResult({
        ok: false,
        code: "read_failed",
        message: "Public shop products could not be read safely."
      });
    }

    const rows = (await response.json()) as SupabasePublicShopProductRow[];
    const safeRows = rows.filter((row) => !isAlcoholRelated(row));
    const safetyFiltered = safeRows.length !== rows.length;
    const items = safeRows.map(mapPublicShopProduct);

    if (items.length === 0) {
      return createPublicShopSupabaseResult({
        ok: false,
        items,
        code: "empty_result",
        message: safetyFiltered
          ? "No safe public shop products remained after safety filtering."
          : "No Supabase public shop products were found.",
        safetyFiltered
      });
    }

    return createPublicShopSupabaseResult({
      ok: true,
      items,
      message: safetyFiltered
        ? "Public shop products read from Supabase test data with safety filtering."
        : "Public shop products read from Supabase test data.",
      safetyFiltered
    });
  } catch {
    return createPublicShopSupabaseResult({
      ok: false,
      code: "server_error",
      message: "Public shop products read failed safely."
    });
  }
}

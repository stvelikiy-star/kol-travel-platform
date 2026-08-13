import type { FoodItem, ProductStatus } from "@/types";
import type { PublicCatalogReadResult, SupabasePublicFoodRow } from "@/lib/data/types";

const publicFoodFields = [
  "id",
  "business_id",
  "title",
  "description",
  "price",
  "status",
  "categories(title)",
  "partners(title,slug)"
].join(",");

const publicCatalogReadTimeoutMs = 1500;

function createPublicFoodSupabaseResult(input: {
  ok: boolean;
  items?: FoodItem[];
  code?: PublicCatalogReadResult<FoodItem>["code"];
  message?: string;
}): PublicCatalogReadResult<FoodItem> {
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

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function toProductStatus(value: string): ProductStatus {
  switch (value) {
    case "active":
    case "out_of_stock":
    case "hidden":
    case "stopped":
    case "under_review":
      return value;
    default:
      return "under_review";
  }
}

function mapPublicFood(row: SupabasePublicFoodRow): FoodItem {
  return {
    id: row.id,
    businessId: row.business_id,
    category: row.categories?.title ?? "Food",
    title: row.title,
    description: row.description ?? "",
    price: toNumber(row.price),
    currency: "KGS",
    status: toProductStatus(row.status)
  };
}

export async function getPublicFoodFromSupabase(): Promise<PublicCatalogReadResult<FoodItem>> {
  const config = getSupabaseReadConfig();

  if (!config) {
    return createPublicFoodSupabaseResult({
      ok: false,
      code: "supabase_not_configured",
      message: "Supabase read environment is not configured."
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), publicCatalogReadTimeoutMs);
    const url = new URL(`${config.restUrl}/menu_items`);
    url.searchParams.set("select", publicFoodFields);
    url.searchParams.set("status", "eq.active");
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
      return createPublicFoodSupabaseResult({
        ok: false,
        code: "table_missing",
        message: "Public food catalog table is not available."
      });
    }

    if (!response.ok) {
      return createPublicFoodSupabaseResult({
        ok: false,
        code: "read_failed",
        message: "Public food catalog could not be read safely."
      });
    }

    const rows = (await response.json()) as SupabasePublicFoodRow[];
    const items = rows.map(mapPublicFood);

    if (items.length === 0) {
      return createPublicFoodSupabaseResult({
        ok: false,
        items,
        code: "empty_result",
        message: "No Supabase public food items were found."
      });
    }

    return createPublicFoodSupabaseResult({
      ok: true,
      items,
      message: "Public food catalog read from Supabase test data."
    });
  } catch {
    return createPublicFoodSupabaseResult({
      ok: false,
      code: "server_error",
      message: "Public food catalog read failed safely."
    });
  }
}

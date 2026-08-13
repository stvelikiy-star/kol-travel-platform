import type { Product } from "@/types";
import { isSupabaseMode } from "@/lib/data/data-source";
import { getMockProducts } from "@/lib/data/mock-data-source";
import { getPublicShopProductsFromSupabase } from "@/lib/data/public-shop-supabase";
import type { PublicCatalogReadResult } from "@/lib/data/types";

export type PublicShopReadMode =
  | "mock_mode"
  | "supabase_success"
  | "fallback_to_mock"
  | "table_missing"
  | "read_failed"
  | "empty_result"
  | "server_error"
  | "safety_filtered"
  | "safety_filtered_empty";

export type PublicShopReadResult = PublicCatalogReadResult<Product> & {
  mode: PublicShopReadMode;
  safetyFiltered?: boolean;
};

function createMockPublicShopReadResult(
  source: PublicCatalogReadResult<Product>["source"] = "mock",
  mode: PublicShopReadMode = "mock_mode",
  safetyFiltered = false
): PublicShopReadResult {
  return {
    ok: true,
    source,
    mode,
    items: getMockProducts(),
    message: source === "fallback"
      ? "Supabase public shop read failed. Returned mock fallback."
      : "Public shop products read from mock data.",
    safetyFiltered
  };
}

function toFallbackMode(
  code?: PublicCatalogReadResult<Product>["code"],
  safetyFiltered = false
): PublicShopReadMode {
  if (safetyFiltered && code === "empty_result") {
    return "safety_filtered_empty";
  }

  if (safetyFiltered) {
    return "safety_filtered";
  }

  switch (code) {
    case "table_missing":
      return "table_missing";
    case "read_failed":
      return "read_failed";
    case "empty_result":
      return "empty_result";
    case "server_error":
      return "server_error";
    default:
      return "fallback_to_mock";
  }
}

export async function getPublicShopReadResult(): Promise<PublicShopReadResult> {
  if (!isSupabaseMode()) {
    return createMockPublicShopReadResult();
  }

  const supabaseResult = await getPublicShopProductsFromSupabase();

  if (supabaseResult.ok) {
    return {
      ...supabaseResult,
      mode: supabaseResult.safetyFiltered ? "safety_filtered" : "supabase_success"
    };
  }

  const fallback = createMockPublicShopReadResult(
    "fallback",
    toFallbackMode(supabaseResult.code, supabaseResult.safetyFiltered),
    supabaseResult.safetyFiltered
  );

  return {
    ...fallback,
    code: supabaseResult.code,
    message: supabaseResult.message ?? fallback.message
  };
}

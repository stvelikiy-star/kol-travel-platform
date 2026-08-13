import type { Product } from "@/types";
import { isSupabaseMode } from "@/lib/data/data-source";
import { getMockProducts } from "@/lib/data/mock-data-source";
import { getPublicShopProductsFromSupabase } from "@/lib/data/public-shop-supabase";
import type { PublicCatalogReadResult } from "@/lib/data/types";

export type PublicShopReadMode =
  | "mock_mode"
  | "supabase_success"
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

function createMockPublicShopReadResult(): PublicShopReadResult {
  return {
    ok: true,
    source: "mock",
    mode: "mock_mode",
    items: getMockProducts(),
    message: "Public shop products read from mock data.",
    safetyFiltered: false
  };
}

function toFailureMode(
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
      return "read_failed";
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

  return {
    ...supabaseResult,
    mode: toFailureMode(supabaseResult.code, supabaseResult.safetyFiltered)
  };
}

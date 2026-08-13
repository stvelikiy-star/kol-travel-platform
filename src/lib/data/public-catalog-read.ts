import type { FoodItem } from "@/types";
import { isSupabaseMode } from "@/lib/data/data-source";
import { getMockFood } from "@/lib/data/mock-data-source";
import { getPublicFoodFromSupabase } from "@/lib/data/public-catalog-supabase";
import type { PublicCatalogReadResult } from "@/lib/data/types";

export type PublicFoodReadMode =
  | "mock_mode"
  | "supabase_success"
  | "fallback_to_mock"
  | "table_missing"
  | "read_failed"
  | "empty_result"
  | "server_error";

export type PublicFoodReadResult = PublicCatalogReadResult<FoodItem> & {
  mode: PublicFoodReadMode;
};

function createMockPublicFoodReadResult(
  source: PublicCatalogReadResult<FoodItem>["source"] = "mock",
  mode: PublicFoodReadMode = "mock_mode"
): PublicFoodReadResult {
  return {
    ok: true,
    source,
    mode,
    items: getMockFood(),
    message: source === "fallback"
      ? "Supabase public food catalog read failed. Returned mock fallback."
      : "Public food catalog read from mock data."
  };
}

function toFallbackMode(code?: PublicCatalogReadResult<FoodItem>["code"]): PublicFoodReadMode {
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

export async function getPublicFoodReadResult(): Promise<PublicFoodReadResult> {
  if (!isSupabaseMode()) {
    return createMockPublicFoodReadResult();
  }

  const supabaseResult = await getPublicFoodFromSupabase();

  if (supabaseResult.ok) {
    return {
      ...supabaseResult,
      mode: "supabase_success"
    };
  }

  const fallback = createMockPublicFoodReadResult("fallback", toFallbackMode(supabaseResult.code));

  return {
    ...fallback,
    code: supabaseResult.code,
    message: supabaseResult.message ?? fallback.message
  };
}

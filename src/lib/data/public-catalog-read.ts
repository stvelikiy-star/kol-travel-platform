import type { FoodItem } from "@/types";
import { isSupabaseMode } from "@/lib/data/data-source";
import { getMockFood } from "@/lib/data/mock-data-source";
import { getPublicFoodFromSupabase } from "@/lib/data/public-catalog-supabase";
import type { PublicCatalogReadResult } from "@/lib/data/types";

const LAUNCH_DEMO_ID = "43000000-0000-0000-0000-000000000001";

export type PublicFoodReadMode =
  | "mock_mode"
  | "supabase_success"
  | "table_missing"
  | "read_failed"
  | "empty_result"
  | "server_error";

export type PublicFoodReadResult = PublicCatalogReadResult<FoodItem> & {
  mode: PublicFoodReadMode;
};

function createMockPublicFoodReadResult(): PublicFoodReadResult {
  return {
    ok: true,
    source: "mock",
    mode: "mock_mode",
    items: getMockFood(),
    message: "Public food catalog read from mock data."
  };
}

function toFailureMode(code?: PublicCatalogReadResult<FoodItem>["code"]): PublicFoodReadMode {
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

export async function getPublicFoodReadResult(): Promise<PublicFoodReadResult> {
  if (!isSupabaseMode()) {
    return createMockPublicFoodReadResult();
  }

  const supabaseResult = await getPublicFoodFromSupabase();

  if (supabaseResult.ok) {
    const liveItems = supabaseResult.items.filter((item) => item.id !== LAUNCH_DEMO_ID);
    return {
      ...supabaseResult,
      items: liveItems,
      mode: "supabase_success"
    };
  }

  return {
    ...supabaseResult,
    mode: toFailureMode(supabaseResult.code)
  };
}

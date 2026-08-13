import type { Tour } from "@/types";
import { isSupabaseMode } from "@/lib/data/data-source";
import { getMockTours } from "@/lib/data/mock-data-source";
import { getPublicToursFromSupabase } from "@/lib/data/public-tours-supabase";
import type { PublicCatalogReadResult } from "@/lib/data/types";

export type PublicToursReadMode =
  | "mock_mode"
  | "supabase_success"
  | "table_missing"
  | "read_failed"
  | "empty_result"
  | "server_error";

export type PublicToursReadResult = PublicCatalogReadResult<Tour> & {
  mode: PublicToursReadMode;
};

function createMockPublicToursReadResult(): PublicToursReadResult {
  return {
    ok: true,
    source: "mock",
    mode: "mock_mode",
    items: getMockTours(),
    message: "Public tours read from mock data."
  };
}

function toFailureMode(code?: PublicCatalogReadResult<Tour>["code"]): PublicToursReadMode {
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

export async function getPublicToursReadResult(): Promise<PublicToursReadResult> {
  if (!isSupabaseMode()) {
    return createMockPublicToursReadResult();
  }

  const supabaseResult = await getPublicToursFromSupabase();

  if (supabaseResult.ok) {
    return {
      ...supabaseResult,
      mode: "supabase_success"
    };
  }

  return {
    ...supabaseResult,
    mode: toFailureMode(supabaseResult.code)
  };
}

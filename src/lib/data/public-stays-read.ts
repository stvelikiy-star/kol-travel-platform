import type { Stay } from "@/types";
import { isSupabaseMode } from "@/lib/data/data-source";
import { getMockStays } from "@/lib/data/mock-data-source";
import { getPublicStaysFromSupabase } from "@/lib/data/public-stays-supabase";
import type { PublicCatalogReadResult } from "@/lib/data/types";

export type PublicStaysReadMode =
  | "mock_mode"
  | "supabase_success"
  | "table_missing"
  | "read_failed"
  | "empty_result"
  | "server_error";

export type PublicStaysReadResult = PublicCatalogReadResult<Stay> & {
  mode: PublicStaysReadMode;
};

function createMockPublicStaysReadResult(): PublicStaysReadResult {
  return {
    ok: true,
    source: "mock",
    mode: "mock_mode",
    items: getMockStays(),
    message: "Public stays read from mock data."
  };
}

function toFailureMode(code?: PublicCatalogReadResult<Stay>["code"]): PublicStaysReadMode {
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

export async function getPublicStaysReadResult(): Promise<PublicStaysReadResult> {
  if (!isSupabaseMode()) {
    return createMockPublicStaysReadResult();
  }

  const supabaseResult = await getPublicStaysFromSupabase();

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

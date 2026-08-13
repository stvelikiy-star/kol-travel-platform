import { isSupabaseMode } from "@/lib/data/data-source";
import {
  createMockPartnerCatalogResult,
  getMockPartnerCatalogOverview,
  getMockPartnerFoodCatalogItems,
  getMockPartnerProductsCatalogItems,
  getMockPartnerStaysCatalogItems,
  getMockPartnerToursCatalogItems
} from "@/lib/data/partner-catalog-mock";
import {
  getPartnerCatalogOverviewFromSupabase,
  getPartnerFoodCatalogFromSupabase,
  getPartnerProductsCatalogFromSupabase,
  getPartnerStaysCatalogFromSupabase,
  getPartnerToursCatalogFromSupabase
} from "@/lib/data/partner-catalog-supabase";
import type { PartnerCatalogItem, PartnerCatalogReadResult } from "@/lib/types/partner-catalog";

function fallback(items: PartnerCatalogItem[], result?: PartnerCatalogReadResult): PartnerCatalogReadResult {
  return {
    ...createMockPartnerCatalogResult(items, "fallback", "fallback_to_mock"),
    code: result?.mode,
    errorSafeMessage: result?.errorSafeMessage ?? "Partner catalog read fell back to mock data."
  };
}

async function readOrMock(
  mockItems: PartnerCatalogItem[],
  readSupabase: () => Promise<PartnerCatalogReadResult>
): Promise<PartnerCatalogReadResult> {
  if (!isSupabaseMode()) {
    return createMockPartnerCatalogResult(mockItems);
  }

  const result = await readSupabase();
  return result.ok ? result : fallback(mockItems, result);
}

export async function getPartnerCatalogOverviewReadResult() {
  if (!isSupabaseMode()) {
    return getMockPartnerCatalogOverview();
  }

  const result = await getPartnerCatalogOverviewFromSupabase();
  return result.ok ? result : getMockPartnerCatalogOverview();
}

export function getPartnerFoodCatalogReadResult() {
  return readOrMock(getMockPartnerFoodCatalogItems(), getPartnerFoodCatalogFromSupabase);
}

export function getPartnerToursCatalogReadResult() {
  return readOrMock(getMockPartnerToursCatalogItems(), getPartnerToursCatalogFromSupabase);
}

export function getPartnerStaysCatalogReadResult() {
  return readOrMock(getMockPartnerStaysCatalogItems(), getPartnerStaysCatalogFromSupabase);
}

export function getPartnerProductsCatalogReadResult() {
  return readOrMock(getMockPartnerProductsCatalogItems(), getPartnerProductsCatalogFromSupabase);
}

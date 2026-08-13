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

async function readOrMock(
  mockItems: PartnerCatalogItem[],
  readSupabase: () => Promise<PartnerCatalogReadResult>
): Promise<PartnerCatalogReadResult> {
  if (!isSupabaseMode()) {
    return createMockPartnerCatalogResult(mockItems);
  }

  return readSupabase();
}

export async function getPartnerCatalogOverviewReadResult() {
  if (!isSupabaseMode()) {
    return getMockPartnerCatalogOverview();
  }

  return getPartnerCatalogOverviewFromSupabase();
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

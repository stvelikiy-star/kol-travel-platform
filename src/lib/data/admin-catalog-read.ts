import { isSupabaseMode } from "@/lib/data/data-source";
import {
  createMockAdminCatalogResult,
  getMockAdminCatalogOverview,
  getMockAdminCategories,
  getMockAdminFoodCatalogItems,
  getMockAdminProductsCatalogItems,
  getMockAdminReviewQueue,
  getMockAdminSafetyFlags,
  getMockAdminStaysCatalogItems,
  getMockAdminToursCatalogItems
} from "@/lib/data/admin-catalog-mock";
import {
  getAdminCatalogOverviewFromSupabase,
  getAdminCatalogReviewQueueFromSupabase,
  getAdminCatalogSafetyFromSupabase,
  getAdminCategoriesFromSupabase,
  getAdminFoodCatalogFromSupabase,
  getAdminProductsCatalogFromSupabase,
  getAdminStaysCatalogFromSupabase,
  getAdminToursCatalogFromSupabase
} from "@/lib/data/admin-catalog-supabase";
import type {
  AdminCatalogCategoryView,
  AdminCatalogItem,
  AdminCatalogOverview,
  AdminCatalogReadResult,
  AdminCatalogSafetyFlag
} from "@/lib/types/admin-catalog";

async function readOrMock(
  mockItems: AdminCatalogItem[],
  readSupabase: () => Promise<AdminCatalogReadResult>
): Promise<AdminCatalogReadResult> {
  if (!isSupabaseMode()) {
    return createMockAdminCatalogResult(mockItems);
  }

  return readSupabase();
}

export async function getAdminCatalogOverviewReadResult(): Promise<AdminCatalogReadResult<AdminCatalogOverview>> {
  if (!isSupabaseMode()) {
    return getMockAdminCatalogOverview();
  }

  return getAdminCatalogOverviewFromSupabase();
}

export function getAdminCatalogReviewQueueReadResult(): Promise<AdminCatalogReadResult<AdminCatalogItem[]>> {
  return readOrMock(getMockAdminReviewQueue(), getAdminCatalogReviewQueueFromSupabase);
}

export function getAdminFoodCatalogReadResult(): Promise<AdminCatalogReadResult<AdminCatalogItem[]>> {
  return readOrMock(getMockAdminFoodCatalogItems(), getAdminFoodCatalogFromSupabase);
}

export function getAdminToursCatalogReadResult(): Promise<AdminCatalogReadResult<AdminCatalogItem[]>> {
  return readOrMock(getMockAdminToursCatalogItems(), getAdminToursCatalogFromSupabase);
}

export function getAdminStaysCatalogReadResult(): Promise<AdminCatalogReadResult<AdminCatalogItem[]>> {
  return readOrMock(getMockAdminStaysCatalogItems(), getAdminStaysCatalogFromSupabase);
}

export function getAdminProductsCatalogReadResult(): Promise<AdminCatalogReadResult<AdminCatalogItem[]>> {
  return readOrMock(getMockAdminProductsCatalogItems(), getAdminProductsCatalogFromSupabase);
}

export async function getAdminCategoriesReadResult(): Promise<AdminCatalogReadResult<AdminCatalogCategoryView[]>> {
  if (!isSupabaseMode()) {
    return createMockAdminCatalogResult(getMockAdminCategories());
  }

  return getAdminCategoriesFromSupabase();
}

export async function getAdminCatalogSafetyReadResult(): Promise<AdminCatalogReadResult<AdminCatalogSafetyFlag[]>> {
  if (!isSupabaseMode()) {
    return createMockAdminCatalogResult(getMockAdminSafetyFlags());
  }

  return getAdminCatalogSafetyFromSupabase();
}

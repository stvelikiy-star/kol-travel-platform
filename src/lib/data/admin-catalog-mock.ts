import { getCatalogSafetyFlags } from "@/lib/data/catalog-safety";
import { getMockFood, getMockPartners, getMockProducts, getMockStays, getMockTours } from "@/lib/data/mock-data-source";
import type {
  AdminCatalogCategoryView,
  AdminCatalogCounts,
  AdminCatalogDomain,
  AdminCatalogItem,
  AdminCatalogOverview,
  AdminCatalogReadResult,
  AdminCatalogSafetyFlag,
  AdminCatalogStatus
} from "@/lib/types/admin-catalog";

export function normalizeAdminCatalogStatus(value?: string | null, safetyFlagged = false): AdminCatalogStatus {
  if (safetyFlagged) {
    return "safety_flagged";
  }

  switch (value) {
    case "draft":
    case "under_review":
    case "approved":
    case "published":
    case "active":
    case "rejected":
    case "archived":
      return value;
    default:
      return "unknown";
  }
}

export function createAdminCatalogCounts(items: Array<{ status: AdminCatalogStatus; safetyFlags?: string[] }>): AdminCatalogCounts {
  return {
    active: items.filter((item) => item.status === "active").length,
    approved: items.filter((item) => item.status === "approved").length,
    archived: items.filter((item) => item.status === "archived").length,
    draft: items.filter((item) => item.status === "draft").length,
    published: items.filter((item) => item.status === "published").length,
    rejected: items.filter((item) => item.status === "rejected").length,
    safety_flagged: items.filter((item) => item.status === "safety_flagged" || (item.safetyFlags?.length ?? 0) > 0).length,
    total: items.length,
    under_review: items.filter((item) => item.status === "under_review").length,
    unknown: items.filter((item) => item.status === "unknown").length
  };
}

function businessTitle(businessId?: string) {
  return getMockPartners().find((partner) => partner.id === businessId)?.title ?? "Demo business";
}

export function getMockAdminFoodCatalogItems(): AdminCatalogItem[] {
  return getMockFood().map((item) => ({
    businessId: item.businessId,
    businessTitle: businessTitle(item.businessId),
    category: item.category,
    currency: item.currency,
    description: item.description,
    domain: "food",
    id: item.id,
    price: item.price,
    preparationTimeMinutes: 20,
    safetyFlags: [],
    status: normalizeAdminCatalogStatus(item.status),
    title: item.title,
    updatedAt: "mock"
  }));
}

export function getMockAdminToursCatalogItems(): AdminCatalogItem[] {
  return getMockTours().map((item) => ({
    businessId: item.businessId,
    businessTitle: businessTitle(item.businessId),
    category: "Tours",
    currency: item.currency,
    description: item.description,
    domain: "tours",
    id: item.id,
    location: item.location,
    price: item.price,
    status: normalizeAdminCatalogStatus(item.status),
    title: item.title,
    type: item.duration,
    updatedAt: "mock"
  }));
}

export function getMockAdminStaysCatalogItems(): AdminCatalogItem[] {
  return getMockStays().map((item) => ({
    businessId: item.businessId,
    businessTitle: businessTitle(item.businessId),
    category: "Stays",
    currency: item.currency,
    description: item.description,
    domain: "stays",
    id: item.id,
    location: item.location,
    price: item.minPricePerNight,
    status: normalizeAdminCatalogStatus(item.status),
    title: item.title,
    type: item.type,
    updatedAt: "mock"
  }));
}

export function getMockAdminProductsCatalogItems(): AdminCatalogItem[] {
  return getMockProducts().map((item) => {
    const safetyFlags = getCatalogSafetyFlags({
      category: item.category,
      description: item.description,
      price: item.price,
      status: item.status,
      title: item.title
    });

    return {
      businessId: item.businessId,
      businessTitle: businessTitle(item.businessId),
      category: item.category,
      currency: item.currency,
      description: item.description,
      domain: "products",
      id: item.id,
      price: item.price,
      safetyFlags,
      status: normalizeAdminCatalogStatus(item.status, safetyFlags.length > 0),
      stockQty: 24,
      title: item.title,
      updatedAt: "mock"
    };
  });
}

export function getMockAdminCategories(): AdminCatalogCategoryView[] {
  return [
    { id: "category-food", scope: "food", slug: "food", sortOrder: 10, title: "Food" },
    { id: "category-tours", scope: "tours", slug: "tours", sortOrder: 20, title: "Tours" },
    { id: "category-stays", scope: "stays", slug: "stays", sortOrder: 30, title: "Stays" },
    { id: "category-shop", scope: "shop", slug: "shop", sortOrder: 40, title: "Shop" }
  ];
}

export function getMockAdminCatalogItems(domain?: AdminCatalogDomain) {
  const items = [
    ...getMockAdminFoodCatalogItems(),
    ...getMockAdminToursCatalogItems(),
    ...getMockAdminStaysCatalogItems(),
    ...getMockAdminProductsCatalogItems()
  ];

  return domain ? items.filter((item) => item.domain === domain) : items;
}

export function getMockAdminReviewQueue() {
  return getMockAdminCatalogItems().filter((item) => item.status === "under_review" || (item.safetyFlags?.length ?? 0) > 0);
}

export function getMockAdminSafetyFlags(): AdminCatalogSafetyFlag[] {
  return getMockAdminCatalogItems()
    .flatMap((item) =>
      (item.safetyFlags ?? []).map((flag) => ({
        businessId: item.businessId,
        businessTitle: item.businessTitle,
        domain: item.domain,
        itemId: item.id,
        reason: flag,
        severity: flag === "alcohol_keyword_match" ? "critical" : "medium",
        status: item.status,
        title: item.title
      }))
    );
}

export function createMockAdminCatalogResult<T extends AdminCatalogItem[] | AdminCatalogCategoryView[] | AdminCatalogSafetyFlag[]>(
  items: T,
  source: AdminCatalogReadResult["source"] = "mock",
  mode: AdminCatalogReadResult["mode"] = "mock_mode"
): AdminCatalogReadResult<T> {
  const countItems = Array.isArray(items) && items.length > 0 && "status" in items[0]
    ? (items as AdminCatalogItem[])
    : [];

  return {
    counts: createAdminCatalogCounts(countItems),
    fallbackUsed: source === "fallback",
    items,
    mode,
    ok: true,
    source
  };
}

export function getMockAdminCatalogOverview(): AdminCatalogReadResult<AdminCatalogOverview> {
  const allItems = getMockAdminCatalogItems();
  const safetyFlags = getMockAdminSafetyFlags();
  const overview: AdminCatalogOverview = {
    counts: createAdminCatalogCounts(allItems),
    domains: [
      { counts: createAdminCatalogCounts(getMockAdminFoodCatalogItems()), domain: "food", href: "/admin/catalog/food", label: "Food" },
      { counts: createAdminCatalogCounts(getMockAdminToursCatalogItems()), domain: "tours", href: "/admin/catalog/tours", label: "Tours" },
      { counts: createAdminCatalogCounts(getMockAdminStaysCatalogItems()), domain: "stays", href: "/admin/catalog/stays", label: "Stays" },
      { counts: createAdminCatalogCounts(getMockAdminProductsCatalogItems()), domain: "products", href: "/admin/catalog/products", label: "Products" },
      { counts: createAdminCatalogCounts([]), domain: "categories", href: "/admin/catalog/categories", label: "Categories" }
    ],
    reviewCount: getMockAdminReviewQueue().length,
    safetyFlagCount: safetyFlags.length
  };

  return {
    counts: overview.counts,
    fallbackUsed: false,
    items: overview,
    mode: "mock_mode",
    ok: true,
    source: "mock"
  };
}

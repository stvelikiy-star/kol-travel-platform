import { getCatalogSafetyFlags } from "@/lib/data/catalog-safety";
import { getMockFood, getMockPartners, getMockProducts, getMockStays, getMockTours } from "@/lib/data/mock-data-source";
import type {
  PartnerBusinessContext,
  PartnerCatalogCounts,
  PartnerCatalogDomain,
  PartnerCatalogItem,
  PartnerCatalogOverview,
  PartnerCatalogReadResult,
  PartnerCatalogStatus
} from "@/lib/types/partner-catalog";

const demoPartnerBusinessId = "business-restaurant-naryn";

export function createPartnerCatalogCounts(items: Array<{ status: PartnerCatalogStatus }>): PartnerCatalogCounts {
  return {
    active: items.filter((item) => item.status === "active").length,
    approved: items.filter((item) => item.status === "approved").length,
    archived: items.filter((item) => item.status === "archived").length,
    draft: items.filter((item) => item.status === "draft").length,
    published: items.filter((item) => item.status === "published").length,
    rejected: items.filter((item) => item.status === "rejected").length,
    total: items.length,
    under_review: items.filter((item) => item.status === "under_review").length,
    unknown: items.filter((item) => item.status === "unknown").length
  };
}

export function normalizePartnerCatalogStatus(value?: string | null): PartnerCatalogStatus {
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

export function getMockPartnerBusinessContext(): PartnerBusinessContext {
  const partner = getMockPartners().find((item) => item.id === demoPartnerBusinessId) ?? getMockPartners()[0];

  return {
    businessId: partner.id,
    businessTitle: partner.title,
    ownershipResolved: true
  };
}

function businessTitle(businessId: string) {
  return getMockPartners().find((partner) => partner.id === businessId)?.title ?? "Demo business";
}

export function getMockPartnerFoodCatalogItems(): PartnerCatalogItem[] {
  return getMockFood()
    .filter((item) => item.businessId === demoPartnerBusinessId)
    .map((item) => ({
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
      status: normalizePartnerCatalogStatus(item.status),
      title: item.title,
      updatedAt: "mock"
    }));
}

export function getMockPartnerToursCatalogItems(): PartnerCatalogItem[] {
  return getMockTours()
    .filter((item) => item.businessId === "business-guide-bishkek")
    .map((item) => ({
      businessId: item.businessId,
      businessTitle: businessTitle(item.businessId),
      category: "Tours",
      currency: item.currency,
      description: item.description,
      domain: "tours",
      id: item.id,
      location: item.location,
      price: item.price,
      status: normalizePartnerCatalogStatus(item.status),
      title: item.title,
      type: item.duration,
      updatedAt: "mock"
    }));
}

export function getMockPartnerStaysCatalogItems(): PartnerCatalogItem[] {
  return getMockStays()
    .filter((item) => item.businessId === "business-guest-bosteri")
    .map((item) => ({
      businessId: item.businessId,
      businessTitle: businessTitle(item.businessId),
      category: "Stays",
      currency: item.currency,
      description: item.description,
      domain: "stays",
      id: item.id,
      location: item.location,
      price: item.minPricePerNight,
      status: normalizePartnerCatalogStatus(item.status),
      title: item.title,
      type: item.type,
      updatedAt: "mock"
    }));
}

export function getMockPartnerProductsCatalogItems(): PartnerCatalogItem[] {
  return getMockProducts()
    .filter((item) => item.businessId === "business-shop-sary-oi")
    .map((item) => ({
      businessId: item.businessId,
      businessTitle: businessTitle(item.businessId),
      category: item.category,
      currency: item.currency,
      description: item.description,
      domain: "products",
      id: item.id,
      price: item.price,
      safetyFlags: getCatalogSafetyFlags({
        category: item.category,
        description: item.description,
        price: item.price,
        status: item.status,
        title: item.title
      }),
      status: normalizePartnerCatalogStatus(item.status),
      stockQty: 24,
      title: item.title,
      updatedAt: "mock"
    }));
}

export function getMockPartnerCatalogItems(domain?: PartnerCatalogDomain) {
  const items = [
    ...getMockPartnerFoodCatalogItems(),
    ...getMockPartnerToursCatalogItems(),
    ...getMockPartnerStaysCatalogItems(),
    ...getMockPartnerProductsCatalogItems()
  ];

  return domain ? items.filter((item) => item.domain === domain) : items;
}

export function createMockPartnerCatalogResult(
  items: PartnerCatalogItem[],
  source: PartnerCatalogReadResult["source"] = "mock",
  mode: PartnerCatalogReadResult["mode"] = "mock_mode"
): PartnerCatalogReadResult {
  return {
    business: getMockPartnerBusinessContext(),
    counts: createPartnerCatalogCounts(items),
    fallbackUsed: source === "fallback",
    items,
    mode,
    ok: true,
    source
  };
}

export function getMockPartnerCatalogOverview(): PartnerCatalogReadResult<PartnerCatalogOverview> {
  const allItems = getMockPartnerCatalogItems();
  const business = getMockPartnerBusinessContext();

  const overview: PartnerCatalogOverview = {
    business,
    counts: createPartnerCatalogCounts(allItems),
    domains: [
      { counts: createPartnerCatalogCounts(getMockPartnerFoodCatalogItems()), domain: "food", href: "/partner/catalog/food", label: "Food" },
      { counts: createPartnerCatalogCounts(getMockPartnerToursCatalogItems()), domain: "tours", href: "/partner/catalog/tours", label: "Tours" },
      { counts: createPartnerCatalogCounts(getMockPartnerStaysCatalogItems()), domain: "stays", href: "/partner/catalog/stays", label: "Stays" },
      { counts: createPartnerCatalogCounts(getMockPartnerProductsCatalogItems()), domain: "products", href: "/partner/catalog/products", label: "Products" }
    ]
  };

  return {
    business,
    counts: overview.counts,
    fallbackUsed: false,
    items: overview,
    mode: "mock_mode",
    ok: true,
    source: "mock"
  };
}

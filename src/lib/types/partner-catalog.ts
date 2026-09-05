export type PartnerCatalogMode =
  | "mock_mode"
  | "supabase_success"
  | "fallback_to_mock"
  | "auth_missing"
  | "partner_profile_missing"
  | "business_missing"
  | "business_inactive"
  | "ownership_mismatch"
  | "read_failed"
  | "empty_result"
  | "server_error";

export type PartnerCatalogStatus =
  | "draft"
  | "under_review"
  | "approved"
  | "published"
  | "active"
  | "rejected"
  | "archived"
  | "unknown";

export type PartnerCatalogDomain = "food" | "tours" | "stays" | "products";

export type PartnerCatalogOperationalStatus =
  | "available"
  | "paused"
  | "out_of_stock"
  | "not_applicable";

export type PartnerCatalogCategory = {
  id: string;
  scope: string;
  title: string;
};

export type PartnerBusinessContext = {
  businessId: string;
  businessTitle: string;
  ownershipResolved: boolean;
};

export type PartnerCatalogCounts = {
  active: number;
  approved: number;
  archived: number;
  draft: number;
  published: number;
  rejected: number;
  total: number;
  under_review: number;
  unknown: number;
};

export type PartnerCatalogItem = {
  businessId: string;
  businessTitle: string;
  category?: string;
  categoryId?: string;
  currency?: "KGS";
  description: string;
  domain: PartnerCatalogDomain;
  id: string;
  location?: string;
  metadata?: Record<string, unknown> | null;
  operationalReason?: string;
  operationalStatus: PartnerCatalogOperationalStatus;
  price?: number;
  preparationTimeMinutes?: number;
  safetyFlags?: string[];
  slug?: string;
  status: PartnerCatalogStatus;
  stockQty?: number;
  title: string;
  type?: string;
  updatedAt: string;
};

export type PartnerCatalogOverview = {
  business: PartnerBusinessContext;
  counts: PartnerCatalogCounts;
  domains: Array<{
    counts: PartnerCatalogCounts;
    domain: PartnerCatalogDomain;
    href: string;
    label: string;
  }>;
};

export type PartnerCatalogReadResult<T = PartnerCatalogItem[]> = {
  business?: PartnerBusinessContext;
  code?: PartnerCatalogMode;
  counts: PartnerCatalogCounts;
  errorSafeMessage?: string;
  fallbackUsed: boolean;
  items: T;
  mode: PartnerCatalogMode;
  ok: boolean;
  source: "mock" | "supabase" | "fallback";
};

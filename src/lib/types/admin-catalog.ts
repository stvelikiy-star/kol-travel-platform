export type AdminCatalogMode =
  | "mock_mode"
  | "supabase_success"
  | "fallback_to_mock"
  | "admin_auth_missing"
  | "admin_role_missing"
  | "admin_role_source_missing"
  | "read_failed"
  | "empty_result"
  | "server_error";

export type AdminCatalogStatus =
  | "draft"
  | "under_review"
  | "approved"
  | "published"
  | "active"
  | "rejected"
  | "archived"
  | "unknown"
  | "safety_flagged";

export type AdminCatalogDomain = "food" | "tours" | "stays" | "products" | "categories";

export type AdminCatalogCounts = {
  active: number;
  approved: number;
  archived: number;
  draft: number;
  published: number;
  rejected: number;
  safety_flagged: number;
  total: number;
  under_review: number;
  unknown: number;
};

export type AdminCatalogItem = {
  businessId?: string;
  businessTitle?: string;
  category?: string;
  currency?: "KGS";
  description?: string;
  domain: AdminCatalogDomain;
  id: string;
  location?: string;
  metadata?: Record<string, unknown> | null;
  price?: number;
  preparationTimeMinutes?: number;
  safetyFlags?: string[];
  status: AdminCatalogStatus;
  stockQty?: number;
  title: string;
  type?: string;
  updatedAt: string;
};

export type AdminCatalogSafetyFlag = {
  businessId?: string;
  businessTitle?: string;
  domain: AdminCatalogDomain;
  itemId: string;
  reason: string;
  severity: "low" | "medium" | "high" | "critical";
  status: AdminCatalogStatus;
  title: string;
};

export type AdminCatalogCategoryView = {
  createdAt?: string;
  id: string;
  parentId?: string | null;
  scope?: string | null;
  slug?: string | null;
  sortOrder?: number | null;
  status?: "active" | "archived" | string;
  title: string;
  updatedAt?: string;
};

export type AdminCatalogOverview = {
  counts: AdminCatalogCounts;
  domains: Array<{
    counts: AdminCatalogCounts;
    domain: AdminCatalogDomain;
    href: string;
    label: string;
  }>;
  reviewCount: number;
  safetyFlagCount: number;
};

export type AdminCatalogReadResult<T = AdminCatalogItem[]> = {
  code?: AdminCatalogMode;
  counts: AdminCatalogCounts;
  errorSafeMessage?: string;
  fallbackUsed: boolean;
  items: T;
  mode: AdminCatalogMode;
  ok: boolean;
  source: "mock" | "supabase" | "fallback";
};

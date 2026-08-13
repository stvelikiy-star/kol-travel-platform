import { AdminCatalogList } from "@/components/admin/AdminCatalogList";
import type { AdminCatalogItem, AdminCatalogReadResult } from "@/lib/types/admin-catalog";

export function AdminCatalogReviewQueue({ result }: { result: AdminCatalogReadResult<AdminCatalogItem[]> }) {
  return (
    <AdminCatalogList
      description="Catalog items that may require admin review. This screen is read-only in Stage 30."
      result={result}
      title="Admin catalog review queue"
    />
  );
}

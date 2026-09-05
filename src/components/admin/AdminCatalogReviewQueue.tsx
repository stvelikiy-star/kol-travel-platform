import { AdminCatalogList } from "@/components/admin/AdminCatalogList";
import type { AdminCatalogItem, AdminCatalogReadResult } from "@/lib/types/admin-catalog";

export function AdminCatalogReviewQueue({
  canModerate,
  result
}: {
  canModerate: boolean;
  result: AdminCatalogReadResult<AdminCatalogItem[]>;
}) {
  return (
    <AdminCatalogList
      canModerate={canModerate}
      description="Authenticated catalog review queue. The first real write slice allows super-admin to approve or reject under-review items through the atomic moderation RPC; publication and broader admin permissions remain outside this stage."
      moderationEnabled
      result={result}
      title="Admin catalog review queue"
    />
  );
}

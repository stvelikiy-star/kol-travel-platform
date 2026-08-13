import { AdminCatalogReviewQueue } from "@/components/admin/AdminCatalogReviewQueue";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { getAdminCatalogReviewQueueReadResult } from "@/lib/data/admin-catalog-read";

export default async function AdminCatalogReviewPage() {
  const result = await getAdminCatalogReviewQueueReadResult();

  return (
    <AdminLayout status="attention">
      <AdminCatalogReviewQueue result={result} />
    </AdminLayout>
  );
}

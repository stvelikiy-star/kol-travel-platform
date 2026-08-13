import { AdminCatalogOverview } from "@/components/admin/AdminCatalogOverview";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { getAdminCatalogOverviewReadResult } from "@/lib/data/admin-catalog-read";

export default async function AdminCatalogPage() {
  const result = await getAdminCatalogOverviewReadResult();

  return (
    <AdminLayout status="stable">
      <AdminCatalogOverview result={result} />
    </AdminLayout>
  );
}

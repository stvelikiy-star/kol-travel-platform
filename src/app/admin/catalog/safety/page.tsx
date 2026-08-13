import { AdminCatalogSafetyPanel } from "@/components/admin/AdminCatalogSafetyPanel";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { getAdminCatalogSafetyReadResult } from "@/lib/data/admin-catalog-read";

export default async function AdminCatalogSafetyPage() {
  const result = await getAdminCatalogSafetyReadResult();

  return (
    <AdminLayout status="attention">
      <AdminCatalogSafetyPanel result={result} />
    </AdminLayout>
  );
}

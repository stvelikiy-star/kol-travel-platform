import { AdminCatalogList } from "@/components/admin/AdminCatalogList";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { getAdminToursCatalogReadResult } from "@/lib/data/admin-catalog-read";

export default async function AdminToursCatalogPage() {
  const result = await getAdminToursCatalogReadResult();

  return (
    <AdminLayout status="stable">
      <AdminCatalogList
        description="Read-only admin visibility for public tours catalog records."
        result={result}
        title="Admin tours catalog"
      />
    </AdminLayout>
  );
}

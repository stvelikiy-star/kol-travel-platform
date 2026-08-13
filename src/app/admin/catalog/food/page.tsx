import { AdminCatalogList } from "@/components/admin/AdminCatalogList";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { getAdminFoodCatalogReadResult } from "@/lib/data/admin-catalog-read";

export default async function AdminFoodCatalogPage() {
  const result = await getAdminFoodCatalogReadResult();

  return (
    <AdminLayout status="stable">
      <AdminCatalogList
        description="Read-only admin visibility for public food/menu catalog records."
        result={result}
        title="Admin food catalog"
      />
    </AdminLayout>
  );
}

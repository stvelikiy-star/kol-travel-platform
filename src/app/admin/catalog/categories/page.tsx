import { AdminCatalogCategories } from "@/components/admin/AdminCatalogCategories";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { getAdminCategoriesReadResult } from "@/lib/data/admin-catalog-read";

export default async function AdminCatalogCategoriesPage() {
  const result = await getAdminCategoriesReadResult();

  return (
    <AdminLayout status="stable">
      <AdminCatalogCategories result={result} />
    </AdminLayout>
  );
}

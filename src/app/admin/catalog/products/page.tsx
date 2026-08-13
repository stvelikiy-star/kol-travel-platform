import { AdminCatalogList } from "@/components/admin/AdminCatalogList";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { getAdminProductsCatalogReadResult } from "@/lib/data/admin-catalog-read";

export default async function AdminProductsCatalogPage() {
  const result = await getAdminProductsCatalogReadResult();

  return (
    <AdminLayout status="attention">
      <AdminCatalogList
        description="Read-only admin visibility for public shop product records, including safety flags."
        result={result}
        title="Admin products catalog"
      />
    </AdminLayout>
  );
}

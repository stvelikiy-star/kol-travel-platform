import { AdminCatalogList } from "@/components/admin/AdminCatalogList";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { getAdminStaysCatalogReadResult } from "@/lib/data/admin-catalog-read";

export default async function AdminStaysCatalogPage() {
  const result = await getAdminStaysCatalogReadResult();

  return (
    <AdminLayout status="stable">
      <AdminCatalogList
        description="Read-only admin visibility for public stays catalog records."
        result={result}
        title="Admin stays catalog"
      />
    </AdminLayout>
  );
}

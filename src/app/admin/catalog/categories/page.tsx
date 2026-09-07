import { AdminCatalogCategories } from "@/components/admin/AdminCatalogCategories";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { requireSuperAdmin } from "@/lib/auth/roles";
import { getAdminCategoriesReadResult } from "@/lib/data/admin-catalog-read";

export const dynamic = "force-dynamic";

export default async function AdminCatalogCategoriesPage() {
  const [result, actor] = await Promise.all([
    getAdminCategoriesReadResult(),
    requireSuperAdmin()
  ]);
  const canGovern = actor.ok && result.source === "supabase";

  return (
    <AdminLayout status="stable">
      <AdminCatalogCategories canGovern={canGovern} result={result} />
    </AdminLayout>
  );
}

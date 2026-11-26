import { AdminCatalogList } from "@/components/admin/AdminCatalogList";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { requireSuperAdmin } from "@/lib/auth/roles";
import { getAdminFoodCatalogReadResult } from "@/lib/data/admin-catalog-read";

export const dynamic = "force-dynamic";

export default async function AdminFoodCatalogPage() {
  const [result, actor] = await Promise.all([
    getAdminFoodCatalogReadResult(),
    requireSuperAdmin()
  ]);
  const canGovern = actor.ok && result.source === "supabase";

  return (
    <AdminLayout status="stable">
      <AdminCatalogList
        canGovern={canGovern}
        description="Главный администратор управляет каталогом блюд: публикует одобренные позиции, снимает их с публикации или архивирует через защищённые серверные операции."
        governanceEnabled
        result={result}
        title="Администрирование каталога блюд"
      />
    </AdminLayout>
  );
}

import { AdminCatalogList } from "@/components/admin/AdminCatalogList";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { requireSuperAdmin } from "@/lib/auth/roles";
import { getAdminToursCatalogReadResult } from "@/lib/data/admin-catalog-read";

export const dynamic = "force-dynamic";

export default async function AdminToursCatalogPage() {
  const [result, actor] = await Promise.all([
    getAdminToursCatalogReadResult(),
    requireSuperAdmin()
  ]);
  const canGovern = actor.ok && result.source === "supabase";

  return (
    <AdminLayout status="stable">
      <AdminCatalogList
        canGovern={canGovern}
        description="Главный администратор управляет каталогом туров: публикует одобренные предложения, снимает их с публикации или архивирует через защищённые серверные операции."
        governanceEnabled
        result={result}
        title="Администрирование каталога туров"
      />
    </AdminLayout>
  );
}

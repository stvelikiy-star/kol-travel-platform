import Link from "next/link";
import { AdminCatalogList } from "@/components/admin/AdminCatalogList";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { requireSuperAdmin } from "@/lib/auth/roles";
import { getAdminStaysCatalogReadResult } from "@/lib/data/admin-catalog-read";

export const dynamic = "force-dynamic";

export default async function AdminStaysCatalogPage() {
  const [result, actor] = await Promise.all([
    getAdminStaysCatalogReadResult(),
    requireSuperAdmin()
  ]);
  const canGovern = actor.ok && result.source === "supabase";

  return (
    <AdminLayout status="stable">
      {canGovern ? <Link href="/admin/catalog/rooms" className="mb-4 inline-flex min-h-11 items-center rounded-md border border-primary px-4 text-sm font-semibold text-primary">Проверить и одобрить номера →</Link> : null}
      <AdminCatalogList
        canGovern={canGovern}
        description="Главный администратор управляет каталогом жилья: публикует одобренные объекты, снимает их с публикации или архивирует через защищённые серверные операции."
        governanceEnabled
        result={result}
        title="Администрирование каталога жилья"
      />
    </AdminLayout>
  );
}

import { AdminCatalogList } from "@/components/admin/AdminCatalogList";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { requireSuperAdmin } from "@/lib/auth/roles";
import { getAdminProductsCatalogReadResult } from "@/lib/data/admin-catalog-read";

export const dynamic = "force-dynamic";

export default async function AdminProductsCatalogPage() {
  const [result, actor] = await Promise.all([
    getAdminProductsCatalogReadResult(),
    requireSuperAdmin()
  ]);
  const canGovern = actor.ok && result.source === "supabase";

  return (
    <AdminLayout status="attention">
      <AdminCatalogList
        canGovern={canGovern}
        description="Каталог товаров защищён проверками безопасности. Публикация товаров с предупреждениями или признаками алкогольной продукции блокируется в интерфейсе и базе данных."
        governanceEnabled
        result={result}
        title="Администрирование каталога товаров"
      />
    </AdminLayout>
  );
}

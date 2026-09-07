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
      <AdminCatalogList
        canGovern={canGovern}
        description="Authenticated Stays catalog governance. Super-admin can publish approved items, unpublish active items, or archive controlled states through audited atomic RPC authority."
        governanceEnabled
        result={result}
        title="Admin stays catalog"
      />
    </AdminLayout>
  );
}

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
        description="Authenticated Shop catalog governance with safety flags. Publish is additionally blocked for safety-flagged/alcohol-like content at both UI and DB authority."
        governanceEnabled
        result={result}
        title="Admin products catalog"
      />
    </AdminLayout>
  );
}

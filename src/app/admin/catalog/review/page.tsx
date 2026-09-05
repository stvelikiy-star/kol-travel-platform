import { AdminCatalogReviewQueue } from "@/components/admin/AdminCatalogReviewQueue";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent } from "@/components/ui/Card";
import { requireSuperAdmin } from "@/lib/auth/roles";
import { getAdminCatalogReviewQueueReadResult } from "@/lib/data/admin-catalog-read";

export const dynamic = "force-dynamic";

type AdminCatalogReviewSearchParams = {
  adminCatalogAction?: string | string[];
  action?: string | string[];
  code?: string | string[];
};

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminCatalogReviewPage({
  searchParams
}: {
  searchParams?: Promise<AdminCatalogReviewSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const actionState = first(resolvedSearchParams?.adminCatalogAction);
  const action = first(resolvedSearchParams?.action);
  const actionCode = first(resolvedSearchParams?.code);
  const [result, moderator] = await Promise.all([
    getAdminCatalogReviewQueueReadResult(),
    requireSuperAdmin()
  ]);
  const canModerate = moderator.ok && result.source === "supabase";

  return (
    <AdminLayout status="attention">
      {actionState ? (
        <Card className={actionState === "success" ? "border-success/40 bg-success/10" : "border-danger/40 bg-danger/10"}>
          <CardContent className="p-4 text-sm font-medium leading-6 text-foreground" role="status">
            {actionState === "success"
              ? action === "approve"
                ? "Catalog item approved. It is not published or activated by this action."
                : action === "reject"
                  ? "Catalog item rejected and the moderation decision was recorded in audit history."
                  : "Catalog moderation action was committed by the server."
              : `Moderation action was rejected safely${actionCode ? `: ${actionCode}` : "."}`}
          </CardContent>
        </Card>
      ) : null}
      <AdminCatalogReviewQueue canModerate={canModerate} result={result} />
    </AdminLayout>
  );
}

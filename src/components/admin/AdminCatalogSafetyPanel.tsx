import { AdminCatalogEmptyState } from "@/components/admin/AdminCatalogEmptyState";
import { AdminCatalogModeBadge } from "@/components/admin/AdminCatalogModeBadge";
import { AdminCatalogStatusBadge } from "@/components/admin/AdminCatalogStatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import type { AdminCatalogReadResult, AdminCatalogSafetyFlag } from "@/lib/types/admin-catalog";

export function AdminCatalogSafetyPanel({ result }: { result: AdminCatalogReadResult<AdminCatalogSafetyFlag[]> }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Catalog safety flags</CardTitle>
              <CardDescription>Read-only product/alcohol safety review. Alcohol remains disabled.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <AdminCatalogModeBadge mode={result.mode} />
              <Badge variant="danger">Alcohol disabled</Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {result.items.length === 0 ? (
        <AdminCatalogEmptyState label="No safety flags found." />
      ) : (
        <div className="grid gap-3">
          {result.items.map((flag) => (
            <Card key={`${flag.domain}-${flag.itemId}-${flag.reason}`}>
              <CardContent className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{flag.title}</p>
                    <p className="text-sm text-muted">{flag.businessTitle ?? "Business"} - {flag.businessId ?? "n/a"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={flag.severity === "critical" ? "danger" : "warning"}>{flag.severity}</Badge>
                    <AdminCatalogStatusBadge status={flag.status} />
                  </div>
                </div>
                <p className="text-sm text-muted">{flag.reason}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

import { AdminCatalogEmptyState } from "@/components/admin/AdminCatalogEmptyState";
import { AdminCatalogGovernanceActions } from "@/components/admin/AdminCatalogGovernanceActions";
import { AdminCatalogModeBadge } from "@/components/admin/AdminCatalogModeBadge";
import { AdminCatalogModerationActions } from "@/components/admin/AdminCatalogModerationActions";
import { AdminCatalogSafetyBadge } from "@/components/admin/AdminCatalogSafetyBadge";
import { AdminCatalogStatusBadge } from "@/components/admin/AdminCatalogStatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import type { AdminCatalogItem, AdminCatalogReadResult } from "@/lib/types/admin-catalog";

export function AdminCatalogList({
  canGovern = false,
  canModerate = false,
  description,
  governanceEnabled = false,
  moderationEnabled = false,
  result,
  title
}: {
  canGovern?: boolean;
  canModerate?: boolean;
  description: string;
  governanceEnabled?: boolean;
  moderationEnabled?: boolean;
  result: AdminCatalogReadResult<AdminCatalogItem[]>;
  title: string;
}) {
  const items = result.items;
  const writeEnabled = result.source === "supabase" && (
    (moderationEnabled && canModerate) || (governanceEnabled && canGovern)
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <AdminCatalogModeBadge mode={result.mode} />
              <Badge variant={writeEnabled ? "success" : "info"}>
                {writeEnabled ? "Super-admin catalog writes enabled" : "Read-only admin view"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Total" value={result.counts.total} />
          <Metric label="Review" value={result.counts.under_review} />
          <Metric label="Active/published" value={result.counts.active + result.counts.published} />
          <Metric label="Safety flagged" value={result.counts.safety_flagged} />
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <AdminCatalogEmptyState />
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <Card key={`${item.domain}-${item.id}`}>
              <CardContent className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{item.title}</p>
                    <p className="text-sm text-muted">{item.businessTitle ?? "Business"} - {item.businessId ?? "n/a"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <AdminCatalogStatusBadge status={item.status} />
                    <AdminCatalogSafetyBadge flags={item.safetyFlags} />
                  </div>
                </div>
                <p className="text-sm leading-6 text-muted">{item.description ?? "No description"}</p>
                <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Domain" value={item.domain} />
                  <Field label="Category" value={item.category ?? "n/a"} />
                  <Field label="Price" value={typeof item.price === "number" ? `${item.price} ${item.currency ?? "KGS"}` : "n/a"} />
                  <Field label="Updated" value={item.updatedAt || "mock"} />
                </div>
                {moderationEnabled ? (
                  <AdminCatalogModerationActions canModerate={canModerate} item={item} source={result.source} />
                ) : null}
                {governanceEnabled ? (
                  <AdminCatalogGovernanceActions canGovern={canGovern} item={item} source={result.source} />
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-semibold text-primary">{value}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 break-words font-medium text-foreground">{value}</p>
    </div>
  );
}

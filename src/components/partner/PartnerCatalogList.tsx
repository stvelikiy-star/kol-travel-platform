import { PartnerCatalogEmptyState } from "@/components/partner/PartnerCatalogEmptyState";
import { PartnerCatalogModeBadge } from "@/components/partner/PartnerCatalogModeBadge";
import { PartnerCatalogSafetyBadge } from "@/components/partner/PartnerCatalogSafetyBadge";
import { PartnerCatalogStatusBadge } from "@/components/partner/PartnerCatalogStatusBadge";
import { PartnerCatalogCreatePanel, PartnerCatalogItemWritePanel } from "@/components/partner/PartnerCatalogWritePanel";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import type {
  PartnerCatalogCategory,
  PartnerCatalogDomain,
  PartnerCatalogItem,
  PartnerCatalogReadResult
} from "@/lib/types/partner-catalog";

export function PartnerCatalogList({
  categories,
  description,
  domain,
  result,
  title
}: {
  categories: PartnerCatalogCategory[];
  description: string;
  domain: PartnerCatalogDomain;
  result: PartnerCatalogReadResult;
  title: string;
}) {
  const items = result.items as PartnerCatalogItem[];
  const writable = result.source === "supabase" && result.ok && Boolean(result.business?.ownershipResolved);

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
              <PartnerCatalogModeBadge mode={result.mode} />
              <Badge variant={writable ? "success" : "info"}>{writable ? "RPC catalog writes" : "Read-only / fail-closed"}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Total" value={result.counts.total} />
          <Metric label="Under review" value={result.counts.under_review} />
          <Metric label="Active/published" value={result.counts.active + result.counts.published} />
          <Metric label="Rejected/archived" value={result.counts.rejected + result.counts.archived} />
        </CardContent>
      </Card>

      {writable ? (
        <PartnerCatalogCreatePanel categories={categories} domain={domain} />
      ) : (
        <Card className="border-warning/40 bg-warning/10">
          <CardHeader>
            <Badge className="w-fit" variant="warning">Fail-closed</Badge>
            <CardTitle>Запись каталога заблокирована</CardTitle>
            <CardDescription>Draft create/edit/submit включается только при подтверждённой Supabase-сессии и ownership текущего бизнеса. Mock mode не создаёт фиктивные записи.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {items.length === 0 ? (
        <PartnerCatalogEmptyState />
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{item.title}</p>
                    <p className="text-sm text-muted">{item.businessTitle} - {item.businessId}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <PartnerCatalogStatusBadge status={item.status} />
                    {item.domain === "products" ? <PartnerCatalogSafetyBadge flags={item.safetyFlags} /> : null}
                  </div>
                </div>
                <p className="text-sm leading-6 text-muted">{item.description}</p>
                <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Category" value={item.category ?? "n/a"} />
                  <Field label="Price" value={typeof item.price === "number" ? `${item.price} ${item.currency ?? "KGS"}` : "n/a"} />
                  <Field label="Detail" value={item.location ?? item.type ?? "n/a"} />
                  <Field label="Updated" value={item.updatedAt || "mock"} />
                </div>
                {writable ? <PartnerCatalogItemWritePanel categories={categories} domain={domain} item={item} /> : null}
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

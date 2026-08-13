import { PartnerCatalogModeBadge } from "@/components/partner/PartnerCatalogModeBadge";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import type { PartnerCatalogOverview as PartnerCatalogOverviewType, PartnerCatalogReadResult } from "@/lib/types/partner-catalog";

export function PartnerCatalogOverview({ result }: { result: PartnerCatalogReadResult<PartnerCatalogOverviewType> }) {
  const overview = result.items;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Partner catalog</CardTitle>
              <CardDescription>Read-only management visibility for partner-owned catalog records.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <PartnerCatalogModeBadge mode={result.mode} />
              <Badge variant="info">Read-only management view</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Business" value={overview.business.businessTitle} />
          <Metric label="Total" value={String(overview.counts.total)} />
          <Metric label="Under review" value={String(overview.counts.under_review)} />
          <Metric label="Active/published" value={String(overview.counts.active + overview.counts.published)} />
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        {overview.domains.map((domain) => (
          <a
            className="block rounded-lg border border-border bg-surface p-5 shadow-card transition hover:border-primary"
            href={domain.href}
            key={domain.domain}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-foreground">{domain.label}</p>
                <p className="mt-1 text-sm text-muted">{domain.counts.total} records</p>
              </div>
              <Badge variant="muted">View only</Badge>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <SmallStat label="Drafts" value={domain.counts.draft} />
              <SmallStat label="Review" value={domain.counts.under_review} />
              <SmallStat label="Active" value={domain.counts.active + domain.counts.published} />
            </div>
          </a>
        ))}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 break-words font-semibold text-primary">{value}</p>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-background p-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-semibold text-foreground">{value}</p>
    </div>
  );
}

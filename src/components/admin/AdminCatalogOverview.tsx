import { AdminCatalogModeBadge } from "@/components/admin/AdminCatalogModeBadge";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import type { AdminCatalogOverview as AdminCatalogOverviewType, AdminCatalogReadResult } from "@/lib/types/admin-catalog";

export function AdminCatalogOverview({ result }: { result: AdminCatalogReadResult<AdminCatalogOverviewType> }) {
  const overview = result.items;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Admin catalog</CardTitle>
              <CardDescription>Read-only moderation visibility across public catalog domains.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <AdminCatalogModeBadge mode={result.mode} />
              <Badge variant="info">Read-only admin view</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Total records" value={overview.counts.total} />
          <Metric label="Under review" value={overview.reviewCount} />
          <Metric label="Published/active" value={overview.counts.published + overview.counts.active} />
          <Metric label="Safety flags" value={overview.safetyFlagCount} />
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
              <SmallStat label="Review" value={domain.counts.under_review} />
              <SmallStat label="Active" value={domain.counts.active + domain.counts.published} />
              <SmallStat label="Flagged" value={domain.counts.safety_flagged} />
            </div>
          </a>
        ))}
        <a
          className="block rounded-lg border border-border bg-surface p-5 shadow-card transition hover:border-primary"
          href="/admin/catalog/review"
        >
          <p className="text-lg font-semibold text-foreground">Review queue</p>
          <p className="mt-1 text-sm text-muted">Items requiring moderation attention.</p>
        </a>
        <a
          className="block rounded-lg border border-border bg-surface p-5 shadow-card transition hover:border-primary"
          href="/admin/catalog/safety"
        >
          <p className="text-lg font-semibold text-foreground">Safety flags</p>
          <p className="mt-1 text-sm text-muted">Read-only alcohol/product safety review.</p>
        </a>
      </section>
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

function SmallStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-background p-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-semibold text-foreground">{value}</p>
    </div>
  );
}

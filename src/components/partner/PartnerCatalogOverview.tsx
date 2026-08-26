import Link from "next/link";
import { PartnerCatalogModeBadge } from "@/components/partner/PartnerCatalogModeBadge";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import type { PartnerCatalogOverview as PartnerCatalogOverviewType, PartnerCatalogReadResult } from "@/lib/types/partner-catalog";

export function PartnerCatalogOverview({ result }: { result: PartnerCatalogReadResult<PartnerCatalogOverviewType> }) {
  const overview = result.items;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge className="border-white/30 bg-white text-primary">KÖL Partner Catalog</Badge>
              <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Каталог партнёра</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">Жильё, туры, меню и товары текущего бизнеса собраны в одном рабочем разделе.</p>
            </div>
            <PartnerCatalogModeBadge mode={result.mode} />
          </div>
        </div>
        <CardContent className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Бизнес" value={overview.business.businessTitle} />
          <Metric label="Всего позиций" value={String(overview.counts.total)} />
          <Metric label="На проверке" value={String(overview.counts.under_review)} />
          <Metric label="Активно" value={String(overview.counts.active + overview.counts.published)} />
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        {overview.domains.map((domain) => (
          <Link
            className="block rounded-lg border border-border bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:border-primary"
            href={domain.href}
            key={domain.domain}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-foreground">{domain.label}</p>
                <p className="mt-1 text-sm text-muted">{domain.counts.total} позиций</p>
              </div>
              <Badge variant="muted">Открыть</Badge>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <SmallStat label="Черновики" value={domain.counts.draft} />
              <SmallStat label="На проверке" value={domain.counts.under_review} />
              <SmallStat label="Активно" value={domain.counts.active + domain.counts.published} />
            </div>
          </Link>
        ))}
      </section>

      <Card className="border-primary/20 bg-lake-light">
        <CardHeader>
          <CardTitle>Изменения каталога проходят проверку</CardTitle>
          <CardDescription>Публикация, изменение доступности и другие значимые операции выполняются через разрешённые процессы текущего бизнеса. Просмотр раздела сам по себе ничего не меняет.</CardDescription>
        </CardHeader>
      </Card>
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

import Link from "next/link";
import { AdminCatalogModeBadge } from "@/components/admin/AdminCatalogModeBadge";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import type { AdminCatalogOverview as AdminCatalogOverviewType, AdminCatalogReadResult } from "@/lib/types/admin-catalog";

export function AdminCatalogOverview({ result }: { result: AdminCatalogReadResult<AdminCatalogOverviewType> }) {
  const overview = result.items;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 via-primary to-accent p-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge className="border-white/30 bg-white text-primary">KÖL Catalog Control</Badge>
              <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Управление каталогом</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">Единый обзор жилья, туров, еды и товаров: публикация, проверка и сигналы безопасности.</p>
            </div>
            <AdminCatalogModeBadge mode={result.mode} />
          </div>
        </div>
        <CardContent className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Всего позиций" value={overview.counts.total} />
          <Metric label="На проверке" value={overview.reviewCount} />
          <Metric label="Опубликовано / активно" value={overview.counts.published + overview.counts.active} />
          <Metric label="Сигналы безопасности" value={overview.safetyFlagCount} />
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
              <SmallStat label="Проверка" value={domain.counts.under_review} />
              <SmallStat label="Активно" value={domain.counts.active + domain.counts.published} />
              <SmallStat label="Сигналы" value={domain.counts.safety_flagged} />
            </div>
          </Link>
        ))}

        <Link className="block rounded-lg border border-border bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:border-primary" href="/admin/catalog/review">
          <Badge className="w-fit" variant="warning">Модерация</Badge>
          <p className="mt-3 text-lg font-semibold text-foreground">Очередь проверки</p>
          <p className="mt-1 text-sm leading-6 text-muted">Позиции, которые требуют решения администратора перед публикацией.</p>
        </Link>

        <Link className="block rounded-lg border border-border bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:border-primary" href="/admin/catalog/safety">
          <Badge className="w-fit" variant="danger">Безопасность</Badge>
          <p className="mt-3 text-lg font-semibold text-foreground">Сигналы безопасности</p>
          <p className="mt-1 text-sm leading-6 text-muted">Отдельная очередь для продуктовых ограничений и контента, требующего ручной проверки.</p>
        </Link>
      </section>

      <Card className="border-primary/20 bg-lake-light">
        <CardHeader>
          <CardTitle>Контроль публикации</CardTitle>
          <CardDescription>Критические изменения каталога проходят проверку прав и модерационные правила. Просмотр экрана не меняет данные автоматически.</CardDescription>
        </CardHeader>
      </Card>
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

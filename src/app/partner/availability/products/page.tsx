import type { ReactNode } from "react";
import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getPartnerProductsCatalogReadResult } from "@/lib/data/partner-catalog-read";

export default async function PartnerProductsAvailabilityPage() {
  const result = await getPartnerProductsCatalogReadResult();
  const items = result.items;
  const unavailable = !result.ok && result.code !== "empty_result";
  const withStock = items.filter((item) => typeof item.stockQty === "number").length;
  const outOfStock = items.filter((item) => item.stockQty === 0).length;

  return (
    <PartnerLayout>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Product availability read-only</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Доступность товаров</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Stock/status читаются только из partner-scoped product catalog. Числа наличия не генерируются по индексу карточки и не подменяются demo-остатками.
          </p>
        </div>
      </Card>

      <Card className={unavailable ? "border-danger/40 bg-danger/10" : "border-primary/20 bg-surface"}>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <div className="flex gap-2"><Badge variant={result.source === "supabase" ? "success" : "info"}>{result.source}</Badge>{result.code ? <Badge variant="muted">{result.code}</Badge> : null}</div>
          <p className="max-w-3xl text-muted">{unavailable ? "Product catalog unavailable; generic catalog fallback is disabled." : "Stock is shown only when the scoped record actually contains stockQty."}</p>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Товары в scope" value={unavailable ? "—" : items.length} />
        <StatCard label="С подтверждённым stockQty" value={unavailable ? "—" : withStock} />
        <StatCard label="stockQty = 0" value={unavailable ? "—" : outOfStock} />
      </section>

      <section className="grid gap-4">
        {items.map((item) => (
          <Card key={item.id}>
            <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{item.title}</CardTitle><CardDescription>{item.id}</CardDescription></div><Badge variant={item.status === "active" || item.status === "published" ? "success" : "muted"}>{item.status}</Badge></div></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Info label="Business" value={item.businessId} />
              <Info label="Category" value={item.category ?? "—"} />
              <Info label="Price" value={item.price !== undefined ? `${item.price} ${item.currency ?? "KGS"}` : "—"} />
              <Info label="Stock" value={item.stockQty !== undefined ? String(item.stockQty) : "not provided"} />
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="border-warning/40 bg-warning/10">
        <CardHeader><CardTitle>Stock/stop writes не выполняются здесь</CardTitle><CardDescription>Inventory decrement, reservation and stop/resume require atomic backend operations and ownership validation. UI не создаёт условные остатки.</CardDescription></CardHeader>
      </Card>

      <BackLink href="/partner/availability">Назад к доступности</BackLink>
    </PartnerLayout>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) { return <Card><CardContent className="space-y-3 p-5"><p className="text-sm font-medium text-muted">{label}</p><p className="text-3xl font-semibold text-primary">{value}</p><Badge variant="muted">scoped catalog</Badge></CardContent></Card>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-md border border-border bg-background p-3"><p className="text-xs text-muted">{label}</p><p className="break-all font-semibold text-foreground">{value}</p></div>; }
function BackLink({ children, href }: { children: ReactNode; href: string }) { return <a className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary" href={href}>{children}</a>; }

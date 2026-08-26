import type { ReactNode } from "react";
import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getPartnerFoodCatalogReadResult } from "@/lib/data/partner-catalog-read";

type PageProps = { params: Promise<{ id: string }> };

export default async function PartnerFoodDetailPage({ params }: PageProps) {
  const { id } = await params;
  const result = await getPartnerFoodCatalogReadResult();
  const item = result.items.find((entry) => entry.id === id);
  const unavailable = !result.ok && result.code !== "empty_result";

  if (!item) {
    return (
      <PartnerLayout>
        <Card className={unavailable ? "border-danger/40 bg-danger/10" : undefined}>
          <CardHeader><Badge className="w-fit" variant={unavailable ? "danger" : "warning"}>{unavailable ? "Read unavailable" : "Not found"}</Badge><CardTitle>{unavailable ? "Позиция недоступна" : "Блюдо не найдено в business scope"}</CardTitle><CardDescription>{unavailable ? "Generic catalog fallback disabled." : "Scoped catalog does not contain this item."}</CardDescription></CardHeader>
          <CardFooter><StyledLink href="/partner/catalog/food">Назад к меню</StyledLink></CardFooter>
        </Card>
      </PartnerLayout>
    );
  }

  return (
    <PartnerLayout>
      <Breadcrumb current="Detail" />
      <Card className="border-primary/20 bg-surface"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><div className="flex gap-2"><Badge variant={result.source === "supabase" ? "success" : "info"}>{result.source}</Badge>{result.code ? <Badge variant="muted">{result.code}</Badge> : null}</div><span className="text-muted">Partner-scoped catalog detail.</span></CardContent></Card>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><Badge variant="info">food item</Badge><CardTitle className="mt-3 text-2xl">{item.title}</CardTitle><CardDescription>{item.id}</CardDescription></div><Badge variant={item.status === "active" || item.status === "published" ? "success" : "muted"}>{item.status}</Badge></div></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-muted">{item.description}</p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Info label="Business" value={item.businessId} />
              <Info label="Category" value={item.category ?? "—"} />
              <Info label="Price" value={item.price !== undefined ? `${item.price} ${item.currency ?? "KGS"}` : "—"} />
              <Info label="Preparation" value={item.preparationTimeMinutes !== undefined ? `${item.preparationTimeMinutes} min` : "—"} />
              <Info label="Updated" value={item.updatedAt} />
            </div>
          </CardContent>
        </Card>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <Card className="border-warning/40 bg-warning/10"><CardHeader><CardTitle>Edit/stop actions locked</CardTitle><CardDescription>Catalog mutations require ownership validation, server-side rules and audit log. No fake Edit/Stop buttons are rendered.</CardDescription></CardHeader></Card>
          <StyledLink href="/partner/catalog/food">Назад к меню</StyledLink>
        </aside>
      </section>
    </PartnerLayout>
  );
}

function Breadcrumb({ current }: { current: string }) { return <Card><CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm font-medium text-muted"><StyledLink href="/partner">Partner</StyledLink><span>/</span><StyledLink href="/partner/catalog">Catalog</StyledLink><span>/</span><StyledLink href="/partner/catalog/food">Food</StyledLink><span>/</span><span className="text-foreground">{current}</span></CardContent></Card>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-md border border-border bg-background p-3"><p className="text-xs text-muted">{label}</p><p className="break-all font-semibold text-foreground">{value}</p></div>; }
function StyledLink({ children, href }: { children: ReactNode; href: string }) { return <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary" href={href}>{children}</a>; }

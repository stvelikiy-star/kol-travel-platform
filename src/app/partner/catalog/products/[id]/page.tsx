import { displayBusinessStatus } from "@/lib/i18n/status-labels";
import type { ReactNode } from "react";
import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getPartnerProductsCatalogReadResult } from "@/lib/data/partner-catalog-read";
import { PartnerCatalogAvailabilityCard } from "@/app/partner/catalog/_components/PartnerCatalogAvailabilityCard";

type PageProps = { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> };
function first(value?: string | string[]) { return Array.isArray(value) ? value[0] : value; }

export default async function PartnerProductDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const result = await getPartnerProductsCatalogReadResult();
  const item = result.items.find((entry) => entry.id === id);
  const unavailable = !result.ok && result.code !== "empty_result";

  if (!item) {
    return (
      <PartnerLayout>
        <Card className={unavailable ? "border-danger/40 bg-danger/10" : undefined}>
          <CardHeader><Badge className="w-fit" variant={unavailable ? "danger" : "warning"}>{unavailable ? "Данные недоступны" : "Не найдено"}</Badge><CardTitle>{unavailable ? "Позиция недоступна" : "Товар не найден в каталоге вашего бизнеса"}</CardTitle><CardDescription>{unavailable ? "Подстановка общего каталога отключена." : "В каталоге вашего бизнеса нет этой позиции."}</CardDescription></CardHeader>
          <CardFooter><StyledLink href="/partner/catalog/products">Назад к товарам</StyledLink></CardFooter>
        </Card>
      </PartnerLayout>
    );
  }

  return (
    <PartnerLayout>
      <Breadcrumb current="Детали" />
      <Card className="border-primary/20 bg-surface"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><div className="flex gap-2"><Badge variant={result.source === "supabase" ? "success" : "info"}>{result.source}</Badge>{result.code ? <Badge variant="muted">{result.code}</Badge> : null}</div><span className="text-muted">Данные каталога только вашего бизнеса.</span></CardContent></Card>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><Badge variant="info">Товар</Badge><CardTitle className="mt-3 text-2xl">{item.title}</CardTitle><CardDescription>{item.id}</CardDescription></div><Badge variant={item.status === "active" || item.status === "published" ? "success" : "muted"}>{displayBusinessStatus(item.status)}</Badge></div></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-muted">{item.description}</p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Info label="Бизнес" value={item.businessId} />
              <Info label="Категория" value={item.category ?? "—"} />
              <Info label="Цена" value={item.price !== undefined ? `${item.price} ${item.currency ?? "KGS"}` : "—"} />
              <Info label="Остаток" value={item.stockQty !== undefined ? String(item.stockQty) : "Не указано"} />
              <Info label="Обновлено" value={item.updatedAt} />
            </div>
          </CardContent>
        </Card>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <PartnerCatalogAvailabilityCard actionResult={first(query?.catalogAction)} code={first(query?.code)} itemId={item.id} itemType="product" operationalReason={item.operationalReason} operationalStatus={item.operationalStatus} />
          <StyledLink href="/partner/catalog/products">Назад к товарам</StyledLink>
        </aside>
      </section>
    </PartnerLayout>
  );
}

function Breadcrumb({ current }: { current: string }) { return <Card><CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm font-medium text-muted"><StyledLink href="/partner">Партнёр</StyledLink><span>/</span><StyledLink href="/partner/catalog">Каталог</StyledLink><span>/</span><StyledLink href="/partner/catalog/products">Товары</StyledLink><span>/</span><span className="text-foreground">{current}</span></CardContent></Card>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-md border border-border bg-background p-3"><p className="text-xs text-muted">{label}</p><p className="break-all font-semibold text-foreground">{value}</p></div>; }
function StyledLink({ children, href }: { children: ReactNode; href: string }) { return <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-xs transition hover:border-primary hover:text-primary" href={href}>{children}</a>; }

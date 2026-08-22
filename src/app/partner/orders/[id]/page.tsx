import type { ReactNode } from "react";
import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { OrderStatusBadge, orderStatusConfig } from "@/components/status/OrderStatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getPartnerOrdersReadResult } from "@/lib/data/partner-orders-read";
import type { Order } from "@/types";

type PartnerOrderDetailPageProps = { params: Promise<{ id: string }> };

export default async function PartnerOrderDetailPage({ params }: PartnerOrderDetailPageProps) {
  const { id } = await params;
  const readResult = await getPartnerOrdersReadResult();
  const unavailable = !readResult.ok && readResult.code !== "empty_result";
  const order = readResult.orders.find((item) => item.id === id);

  if (!order) {
    return (
      <PartnerLayout>
        <Breadcrumb current="Заказ" parentHref="/partner/orders" parentLabel="Заказы" />
        <Card className={unavailable ? "border-danger/40 bg-danger/10" : undefined}>
          <CardHeader>
            <Badge className="w-fit" variant={unavailable ? "danger" : "warning"}>{unavailable ? "Read unavailable" : "Not found"}</Badge>
            <CardTitle>{unavailable ? "Детали заказа недоступны" : "Заказ не найден в доступном scope"}</CardTitle>
            <CardDescription>
              {unavailable
                ? "KÖL не использует общий orders helper как fallback."
                : "Заказ отсутствует среди заказов, доступных текущему партнёру."}
            </CardDescription>
          </CardHeader>
          <CardFooter><StyledLink href="/partner/orders">Вернуться к заказам</StyledLink></CardFooter>
        </Card>
      </PartnerLayout>
    );
  }

  return (
    <PartnerLayout>
      <Breadcrumb current="Заказ" parentHref="/partner/orders" parentLabel="Заказы" />

      <Card className="border-primary/20 bg-surface">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <div className="flex flex-wrap gap-2"><Badge variant={readResult.source === "supabase" ? "success" : "info"}>{readResult.source}</Badge>{readResult.code ? <Badge variant="muted">{readResult.code}</Badge> : null}</div>
          <p className="max-w-3xl leading-6 text-muted">Детали загружены из того же partner-scoped read-контура; client contact/address не раскрываются без отдельного разрешённого delivery contract.</p>
        </CardContent>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><Badge variant="info">Partner order detail</Badge><CardTitle className="mt-3 text-2xl">Детали заказа</CardTitle><CardDescription>{order.id}</CardDescription></div>
                <SafeOrderStatusBadge status={order.status} />
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Info label="Business" value={order.businessId} />
              <Info label="Order type" value={order.type} />
              <Info label="Payment status" value={order.paymentStatus} />
              <Info label="Preparation status" value={preparationStatus(order)} />
              <Info label="Delivery status" value={order.deliveryStatus ?? "not assigned"} />
              <Info label="Created" value={new Date(order.createdAt).toLocaleString("ru-RU")} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Позиции заказа</CardTitle><CardDescription>Только позиции заказа, доступного текущему business scope.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {order.items.map((item) => (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-4" key={item.id}>
                  <div><p className="font-semibold text-foreground">{item.title}</p><p className="text-sm text-muted">{item.itemType} · {item.itemId}</p></div>
                  <p className="text-sm font-semibold text-foreground">{item.quantity} × {item.unitPrice} = {item.totalPrice} {order.currency}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-warning/40 bg-warning/10">
            <CardHeader><CardTitle>Операционные действия</CardTitle><CardDescription>Неподтверждённые accept/reject/cancel/report-problem кнопки на detail page удалены.</CardDescription></CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <Rule>Изменение статуса требует assignment/business ownership check на сервере.</Rule>
              <Rule>Payment status не изменяется partner action.</Rule>
              <Rule>Client address/contact не подставляются из demo или generic order helpers.</Rule>
              <Rule>Разрешённый controlled ready-for-pickup test находится на списке заказов и работает только в Supabase mode.</Rule>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <OrderSummary order={order} />
          <StyledLink href="/partner/orders">Назад к заказам</StyledLink>
        </aside>
      </section>
    </PartnerLayout>
  );
}

function SafeOrderStatusBadge({ status }: { status: string }) {
  if (status in orderStatusConfig) return <OrderStatusBadge status={status as keyof typeof orderStatusConfig} />;
  return <Badge variant="warning">{status}</Badge>;
}

function OrderSummary({ order }: { order: Order }) {
  return (
    <Card>
      <CardHeader><CardTitle>Суммы заказа</CardTitle><CardDescription>Значения читаются из scoped order record; комиссии и выплаты здесь не рассчитываются.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <SummaryRow label="Subtotal" value={`${order.subtotal} ${order.currency}`} />
        <SummaryRow label="Delivery" value={`${order.deliveryFee} ${order.currency}`} />
        <SummaryRow label="Total" strong value={`${order.total} ${order.currency}`} />
      </CardContent>
    </Card>
  );
}

function Breadcrumb({ current, parentHref, parentLabel }: { current: string; parentHref: string; parentLabel: string }) {
  return <Card><CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm font-medium text-muted"><StyledCrumb href="/partner">Кабинет партнёра</StyledCrumb><span>/</span><StyledCrumb href={parentHref}>{parentLabel}</StyledCrumb><span>/</span><span className="text-foreground">{current}</span></CardContent></Card>;
}

function StyledCrumb({ children, href }: { children: ReactNode; href: string }) {
  return <a className="font-semibold text-primary transition hover:opacity-80" href={href}>{children}</a>;
}

function StyledLink({ children, href }: { children: ReactNode; href: string }) {
  return <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary" href={href}>{children}</a>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-border bg-background p-3"><p className="text-xs text-muted">{label}</p><p className="break-all font-semibold text-foreground">{value}</p></div>;
}

function SummaryRow({ label, strong, value }: { label: string; strong?: boolean; value: string }) {
  return <div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted">{label}</span><span className={strong ? "text-lg font-semibold text-primary" : "font-semibold text-foreground"}>{value}</span></div>;
}

function Rule({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-warning/30 bg-surface p-3 font-medium text-foreground">{children}</div>;
}

function preparationStatus(order: Order) {
  if (order.status === "assembling") return "assembling";
  if (["accepted", "accepted_by_partner", "preparing", "ready", "ready_for_pickup"].includes(order.status)) return order.status;
  return "not in preparation";
}

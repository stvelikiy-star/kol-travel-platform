import Link from "next/link";
import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerOrderActions } from "@/components/partner/PartnerOrderActions";
import { OrderStatusBadge, orderStatusConfig } from "@/components/status/OrderStatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getPartnerOrdersReadResult } from "@/lib/data/partner-orders-read";
import type { Order } from "@/types";

export const dynamic = "force-dynamic";

type PartnerOrdersSearchParams = {
  partnerAction?: string | string[];
  action?: string | string[];
  code?: string | string[];
};

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PartnerOrdersPage({ searchParams }: { searchParams?: Promise<PartnerOrdersSearchParams> }) {
  const resolvedSearchParams = await searchParams;
  const actionState = first(resolvedSearchParams?.partnerAction);
  const action = first(resolvedSearchParams?.action);
  const actionCode = first(resolvedSearchParams?.code);
  const readResult = await getPartnerOrdersReadResult();
  const orders = readResult.orders;
  const unavailable = !readResult.ok && readResult.code !== "empty_result";
  const newOrders = orders.filter((order) => order.status === "new").length;
  const inProgressOrders = orders.filter((order) => ["accepted", "accepted_by_partner", "preparing", "assembling"].includes(order.status)).length;
  const readyOrders = orders.filter((order) => ["ready", "ready_for_pickup"].includes(order.status)).length;
  const sourceLabel = readResult.source === "supabase" ? "Подтверждённые данные" : "Безопасное демо";

  return (
    <PartnerLayout>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">KÖL Partner Orders</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Заказы партнёра</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Food/Shop заказы текущего бизнеса: приём, подготовка и готовность к выдаче работают через защищённый атомарный контур.
          </p>
        </div>
      </Card>

      {actionState ? (
        <Card className={actionState === "success" ? "border-success/40 bg-success/10" : "border-danger/40 bg-danger/10"}>
          <CardContent className="p-4 text-sm font-medium leading-6 text-foreground" role="status">
            {actionState === "success"
              ? actionSuccessText(action)
              : `Действие отклонено безопасно${actionCode ? `: ${actionCode}` : "."}`}
          </CardContent>
        </Card>
      ) : null}

      <Card className={unavailable ? "border-danger/40 bg-danger/10" : "border-primary/20 bg-surface"}>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <Badge variant={readResult.source === "supabase" ? "success" : "info"}>{sourceLabel}</Badge>
          <p className="max-w-3xl leading-6 text-muted">
            {unavailable
              ? "Заказы сейчас недоступны. KÖL не расширяет доступ на чужие данные и не подставляет выдуманные значения."
              : readResult.source === "supabase"
                ? "Загружены заказы и item snapshots только текущего partner business scope."
                : "Демо показывает интерфейс без production-записей."}
          </p>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Новые" value={unavailable ? "—" : newOrders} />
        <StatCard label="В работе" value={unavailable ? "—" : inProgressOrders} />
        <StatCard label="Готовы к выдаче" value={unavailable ? "—" : readyOrders} />
      </section>

      <Card className="border-warning/30 bg-warning/5">
        <CardHeader>
          <CardTitle>Граница ответственности</CardTitle>
          <CardDescription>
            Partner lifecycle не создаёт доставку и не меняет payment status. Courier dispatch включается только для валидного delivery-row; checkout сейчас принимает только самовывоз.
          </CardDescription>
        </CardHeader>
      </Card>

      <section className="grid gap-4">
        {orders.map((order) => (
          <Card key={order.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{order.type === "food" ? "Заказ еды" : "Заказ магазина"}</CardTitle>
                  <CardDescription>{order.id}</CardDescription>
                </div>
                <SafeOrderStatusBadge status={order.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Info label="ID бизнеса" value={order.businessId} />
                <Info label="Тип заказа" value={order.type} />
                <Info label="Статус оплаты" value={order.paymentStatus} />
                <Info label="Итого" value={`${order.total} ${order.currency}`} />
                <Info label="Создан" value={new Date(order.createdAt).toLocaleString("ru-RU")} />
                <Info label="Статус доставки" value={order.deliveryStatus ?? "Не создана"} />
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <p className="text-sm font-semibold text-foreground">Позиции заказа</p>
                <div className="mt-3 grid gap-2">
                  {order.items.map((item) => (
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm" key={item.id}>
                      <span className="text-foreground">{item.title}</span>
                      <span className="text-muted">{item.quantity} × {item.unitPrice} = {item.totalPrice} {order.currency}</span>
                    </div>
                  ))}
                  {!order.items.length ? <p className="text-sm text-muted">В заказе нет доступных item snapshots.</p> : null}
                </div>
              </div>

              <PartnerOrderActions
                compact
                detailHref={`/partner/orders/${order.id}`}
                orderId={order.id}
                orderType={order.type}
                status={order.status}
              />
              <Link className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary" href={`/partner/orders/${order.id}`}>
                Открыть детали
              </Link>
            </CardContent>
          </Card>
        ))}
        {!orders.length ? (
          <Card><CardContent className="p-5 text-sm text-muted">{unavailable ? "Данные заказов временно недоступны." : "Заказов у текущего бизнеса пока нет."}</CardContent></Card>
        ) : null}
      </section>
    </PartnerLayout>
  );
}

function actionSuccessText(action?: string) {
  switch (action) {
    case "accept": return "Заказ принят партнёром. Статус и аудит подтверждены сервером.";
    case "reject": return "Food-заказ отклонён до оплаты. Payment truth не изменён.";
    case "start_preparing": return "Заказ переведён в приготовление атомарно.";
    case "mark_ready": return "Заказ подтверждён как готовый к выдаче.";
    case "report_issue": return "Проблема зафиксирована в аудите без изменения заказа или оплаты.";
    case "request_cancellation": return "Запрос отмены зафиксирован для проверки; заказ и оплата не отменены.";
    default: return "Операционное действие подтверждено сервером.";
  }
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return <Card><CardContent className="space-y-3 p-5"><p className="text-sm font-medium text-muted">{label}</p><p className="text-3xl font-semibold text-primary">{value}</p><Badge variant="muted">Заказы</Badge></CardContent></Card>;
}

function SafeOrderStatusBadge({ status }: { status: string }) {
  if (status in orderStatusConfig) return <OrderStatusBadge status={status as keyof typeof orderStatusConfig} />;
  return <Badge variant="warning">{status}</Badge>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-border bg-background p-3"><p className="text-xs text-muted">{label}</p><p className="break-all font-semibold text-foreground">{value}</p></div>;
}

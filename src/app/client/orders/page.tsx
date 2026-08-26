import Link from "next/link";
import { EmptyState } from "@/components/catalog/EmptyState";
import { ClientLayout } from "@/components/layout/ClientLayout";
import { OrderStatusBadge, type ExtendedOrderStatus } from "@/components/status/OrderStatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getClientOrdersReadResult } from "@/lib/data/client-orders-read";

export default async function ClientOrdersPage() {
  const readResult = await getClientOrdersReadResult();
  const orders = readResult.orders;
  const unavailable = !readResult.ok && readResult.code !== "empty_result";
  const sourceLabel = readResult.source === "supabase" ? "Мои данные" : "Безопасное демо";

  return (
    <ClientLayout>
      <Card>
        <CardHeader>
          <Badge className="w-fit" variant="info">KÖL Orders</Badge>
          <CardTitle className="text-2xl">Мои заказы</CardTitle>
          <CardDescription>Клиент видит только собственные заказы. Повтор заказа, отмена, возврат и оплата не запускаются простой загрузкой страницы.</CardDescription>
        </CardHeader>
      </Card>

      <Card className={unavailable ? "border-danger/40 bg-danger/10" : undefined}>
        <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
          <Badge variant={readResult.source === "supabase" ? "success" : "info"}>{sourceLabel}</Badge>
          <span className="text-muted">{unavailable ? "Заказы сейчас недоступны; доступ не расширяется на чужие данные." : readResult.source === "supabase" ? "Загружены заказы текущего клиента." : "Демо показывает интерфейс заказов без изменения production-данных."}</span>
        </CardContent>
      </Card>

      {orders.length === 0 ? (
        <EmptyState actionLabel="Открыть еду" description={unavailable ? "Заказы временно недоступны." : "Заказов пока нет — начните с каталога еды или магазина."} href="/food" title="Заказов пока нет" />
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><CardTitle>{order.type === "food" ? "Заказ еды" : "Заказ магазина"}</CardTitle><CardDescription>{order.id} · {new Date(order.createdAt).toLocaleString("ru-RU")}</CardDescription></div>
                  <OrderStatusBadge status={normalizeOrderStatus(order.status)} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Info label="ID заказа" value={order.id} />
                  <Info label="ID партнёра" value={order.businessId} />
                  <Info label="Партнёр" value={order.partnerTitle ?? "Не указан"} />
                  <Info label="Тип" value={order.type} />
                  <Info label="Статус" value={order.status} />
                  <Info label="Статус оплаты" value={order.paymentStatus} />
                  <Info label="Товары" value={`${order.subtotal} KGS`} />
                  <Info label="Доставка" value={`${order.deliveryFee} KGS`} />
                  <Info label="Скидка" value={`${order.discount} KGS`} />
                  <Info label="Итого" value={`${order.total} KGS`} />
                  <Info label="Обновлено" value={order.updatedAt} />
                </div>
                <div className="rounded-lg border border-primary/20 bg-lake-light p-4 text-sm text-muted">Просмотр заказа не меняет его статус, оплату или итоговые суммы.</div>
              </CardContent>
              <CardFooter>
                <Link className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary" href={`/client/orders/${order.id}`}>Открыть детали</Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </ClientLayout>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-border bg-background p-3"><p className="text-xs text-muted">{label}</p><p className="break-all font-semibold">{value}</p></div>;
}

function normalizeOrderStatus(status: string): ExtendedOrderStatus {
  switch (status) {
    case "new": case "accepted": case "preparing": case "assembling": case "ready": case "delivering": case "completed": case "rejected": case "cancelled": case "age_check": case "age_check_failed": return status;
    case "new_order": return "new";
    case "accepted_by_partner": return "accepted";
    case "ready_for_pickup": return "ready";
    case "courier_to_client": case "picked_up": return "delivering";
    case "delivered": return "completed";
    default: return "new";
  }
}

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

  return (
    <ClientLayout>
      <Card>
        <CardHeader>
          <Badge className="w-fit" variant="info">Orders</Badge>
          <CardTitle className="text-2xl">Мои заказы</CardTitle>
          <CardDescription>Только authenticated client-scoped read. Повтор заказа, отмена, возврат и оплата не имитируются.</CardDescription>
        </CardHeader>
      </Card>

      <Card className={unavailable ? "border-danger/40 bg-danger/10" : undefined}>
        <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
          <Badge variant={readResult.source === "supabase" ? "success" : "info"}>{readResult.source}</Badge>
          {readResult.code ? <Badge variant="muted">{readResult.code}</Badge> : null}
          <span className="text-muted">{unavailable ? "Client orders unavailable; read scope is not broadened." : readResult.message ?? "Client orders loaded through scoped reader."}</span>
        </CardContent>
      </Card>

      {orders.length === 0 ? (
        <EmptyState actionLabel="Открыть еду" description={unavailable ? "Заказы временно недоступны." : "В вашем доступном client scope заказов пока нет."} href="/food" title="Заказов пока нет" />
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
                  <Info label="Order ID" value={order.id} />
                  <Info label="Business" value={order.businessId} />
                  <Info label="Partner" value={order.partnerTitle ?? "unavailable"} />
                  <Info label="Type" value={order.type} />
                  <Info label="Status" value={order.status} />
                  <Info label="Payment status" value={order.paymentStatus} />
                  <Info label="Subtotal" value={`${order.subtotal} KGS`} />
                  <Info label="Delivery fee" value={`${order.deliveryFee} KGS`} />
                  <Info label="Discount" value={`${order.discount} KGS`} />
                  <Info label="Total" value={`${order.total} KGS`} />
                  <Info label="Updated" value={order.updatedAt} />
                </div>
                <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted">Page load does not mutate order, payment, totals or audit state.</div>
              </CardContent>
              <CardFooter>
                <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary" href={`/client/orders/${order.id}`}>Открыть детали</a>
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

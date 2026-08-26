import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getAdminDeliveryReadResult } from "@/lib/data/admin-delivery-read";

const statusVariant: Record<string, BadgeVariant> = {
  new: "info",
  accepted: "success",
  preparing: "warning",
  assembling: "warning",
  ready: "info",
  delivering: "warning",
  completed: "success",
  rejected: "danger",
  cancelled: "danger"
};

export default async function AdminOrdersPage() {
  const readResult = await getAdminDeliveryReadResult();
  const orders = readResult.orders;
  const newOrders = orders.filter((order) => order.status === "new").length;
  const inWork = orders.filter((order) => ["accepted", "preparing", "assembling", "delivering"].includes(order.status)).length;
  const ready = orders.filter((order) => order.status === "ready").length;
  const completed = orders.filter((order) => order.status === "completed").length;
  const attention = orders.filter((order) => ["cancelled", "rejected"].includes(order.status) || order.paymentStatus === "failed").length;
  const unavailable = !readResult.ok && readResult.code !== "empty_result";

  return (
    <AdminLayout status={attention > 0 || unavailable ? "attention" : "stable"}>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Admin CRM</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Заказы</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Операционный обзор Food и Shop заказов. Здесь показываются только данные, доступные текущей административной роли.
          </p>
        </div>
      </Card>

      {unavailable ? (
        <Card className="border-danger/40 bg-danger/10"><CardContent className="p-4 text-sm font-medium">Не удалось безопасно загрузить заказы. Данные не подменяются demo-значениями.</CardContent></Card>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Новые" value={newOrders} tone="info" />
        <StatCard label="В работе" value={inWork} tone="warning" />
        <StatCard label="Готовы" value={ready} tone="info" />
        <StatCard label="Завершённые" value={completed} tone="success" />
        <StatCard label="Требуют проверки" value={attention} tone={attention > 0 ? "danger" : "success"} />
      </section>

      <section className="grid gap-4">
        {orders.map((order) => (
          <Card key={order.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{order.id}</CardTitle>
                  <CardDescription>{order.type === "food" ? "Food" : "Shop"} · {order.partnerTitle ?? order.businessId}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={statusVariant[order.status] ?? "muted"}>{order.status}</Badge>
                  <Badge variant={order.paymentStatus === "paid" ? "success" : order.paymentStatus === "failed" ? "danger" : "muted"}>{order.paymentStatus}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <Info label="Клиент" value={order.clientId} />
              <Info label="Партнёр" value={order.partnerTitle ?? order.businessId} />
              <Info label="Тип" value={order.type} />
              <Info label="Подытог" value={`${order.subtotal} KGS`} />
              <Info label="Доставка" value={`${order.deliveryFee} KGS`} />
              <Info label="Итого" value={`${order.total} KGS`} />
              <Info label="Создан" value={order.createdAt} />
              <Info label="Обновлён" value={order.updatedAt} />
              <Info label="Оплата" value={order.paymentStatus} />
            </CardContent>
          </Card>
        ))}
        {!unavailable && orders.length === 0 ? <EmptyRow text="Заказов пока нет." /> : null}
      </section>

      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle>Контур изменений</CardTitle>
          <CardDescription>Этот экран — безопасный обзор. Статусы заказов, оплаты и доставки изменяются только разрешёнными серверными операциями/RPC с проверкой роли и транзакционными ограничениями.</CardDescription>
        </CardHeader>
      </Card>
    </AdminLayout>
  );
}

function StatCard({ label, tone, value }: { label: string; tone: BadgeVariant; value: string | number }) {
  return (
    <Card><CardContent className="space-y-3 p-5"><p className="text-sm font-medium text-muted">{label}</p><p className="text-3xl font-semibold text-primary">{value}</p><Badge variant={tone}>admin</Badge></CardContent></Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-border bg-background p-3"><p className="text-xs font-medium text-muted">{label}</p><p className="mt-1 break-all font-semibold text-foreground">{value}</p></div>;
}

function EmptyRow({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted">{text}</div>;
}

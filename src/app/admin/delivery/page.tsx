import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getAdminDeliveryReadResult } from "@/lib/data/admin-delivery-read";

const statusVariant: Record<string, BadgeVariant> = {
  pending: "warning",
  new: "warning",
  preparing: "warning",
  ready_for_pickup: "info",
  courier_assigned: "info",
  assigned: "info",
  picked_up: "warning",
  courier_to_client: "warning",
  delivering: "warning",
  delivered: "success",
  completed: "success",
  cancelled: "danger",
  delivery_failed: "danger",
  admin_required: "danger"
};

export default async function AdminDeliveryPage() {
  const readResult = await getAdminDeliveryReadResult();
  const deliveryOrders = readResult.orders;
  const unavailable = !readResult.ok && readResult.code !== "empty_result";
  const unassigned = deliveryOrders.filter((order) => ["new", "preparing", "ready_for_pickup", "pending"].includes(order.status)).length;
  const assigned = deliveryOrders.filter((order) => ["courier_assigned", "assigned"].includes(order.status)).length;
  const inTransit = deliveryOrders.filter((order) => ["picked_up", "courier_to_client", "delivering"].includes(order.status)).length;
  const problems = deliveryOrders.filter((order) => ["cancelled", "delivery_failed", "admin_required"].includes(order.status)).length;
  const sourceLabel = readResult.source === "supabase" ? "Подтверждённый источник" : "Безопасное демо";

  return (
    <AdminLayout status={problems > 0 || unavailable ? "attention" : "stable"}>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">KÖL Delivery Control</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Контроль доставки</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Администратор видит очередь доставки, назначения, движение заказов и проблемные ситуации. Критические изменения выполняются только через защищённые серверные процессы.
          </p>
        </div>
      </Card>

      <Card className={unavailable ? "border-danger/40 bg-danger/10" : "border-primary/20 bg-surface"}>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <Badge variant={readResult.source === "supabase" ? "success" : "info"}>{sourceLabel}</Badge>
          <p className="max-w-3xl leading-6 text-muted">
            {unavailable
              ? "Данные доставки сейчас недоступны. KÖL не подменяет их выдуманными операциями."
              : readResult.source === "supabase"
                ? "Данные доставки загружены из защищённого административного источника."
                : "Демонстрационный режим показывает интерфейс и сценарии без изменения production-данных."}
          </p>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Без назначения" value={unavailable ? "—" : unassigned} tone="warning" />
        <StatCard label="Назначены" value={unavailable ? "—" : assigned} tone="info" />
        <StatCard label="В пути" value={unavailable ? "—" : inTransit} tone="warning" />
        <StatCard label="Требуют внимания" value={unavailable ? "—" : problems} tone={problems > 0 ? "danger" : "success"} />
      </section>

      <Card className="border-primary/20 bg-lake-light">
        <CardHeader>
          <CardTitle>Операционные действия защищены</CardTitle>
          <CardDescription>
            Назначение и переназначение курьера, закрытие проблемы и коммуникации с участниками требуют проверки роли, текущего назначения и журнала изменений.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-2">
          <Rule>Приоритет проблемы строится по фактическому состоянию доставки, а не по позиции строки в интерфейсе.</Rule>
          <Rule>Контактные данные и причины проблем не придумываются системой.</Rule>
          <Rule>AI может рекомендовать следующий шаг только по подтверждённым событиям и правилам сервиса.</Rule>
          <Rule>Статус оплаты остаётся независимым от статуса доставки.</Rule>
        </CardContent>
      </Card>

      <section className="grid gap-4">
        {deliveryOrders.map((order) => (
          <Card key={order.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{order.id}</CardTitle>
                  <CardDescription>{order.partnerTitle ?? order.businessId}</CardDescription>
                </div>
                <Badge variant={statusVariant[order.status] ?? "muted"}>{order.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Info label="Партнёр" value={order.businessId} />
              <Info label="Тип заказа" value={order.type} />
              <Info label="Статус оплаты" value={order.paymentStatus} />
              <Info label="Сумма" value={`${order.total} KGS`} />
              <Info label="Обновлено" value={new Date(order.updatedAt).toLocaleString("ru-RU")} />
            </CardContent>
          </Card>
        ))}
        {!deliveryOrders.length ? (
          <Card><CardContent className="p-5 text-sm text-muted">{unavailable ? "Данные доставки временно недоступны." : "Доставок в доступном контуре пока нет."}</CardContent></Card>
        ) : null}
      </section>
    </AdminLayout>
  );
}

function StatCard({ label, tone, value }: { label: string; tone: BadgeVariant; value: string | number }) {
  return <Card><CardContent className="space-y-3 p-5"><p className="text-sm font-medium text-muted">{label}</p><p className="text-3xl font-semibold text-primary">{value}</p><Badge variant={tone}>Доставка</Badge></CardContent></Card>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-border bg-background p-3"><p className="text-xs font-medium text-muted">{label}</p><p className="mt-1 break-all font-semibold text-foreground">{value}</p></div>;
}

function Rule({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-primary/20 bg-surface p-3 font-medium leading-6 text-foreground">{children}</div>;
}

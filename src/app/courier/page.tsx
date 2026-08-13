import { CourierLayout } from "@/components/layout/CourierLayout";
import { CourierOperationalFinalPanel } from "@/app/courier/_components/CourierOperationalFinalPanel";
import { CourierIssueEscalationPanel } from "@/app/courier/_components/CourierIssueEscalationPanel";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getDeliveryOrders } from "@/lib/data/orders";

type DeliveryDashboardStatus =
  | "delivery_pending"
  | "courier_assigned"
  | "courier_accepted"
  | "courier_to_partner"
  | "picked_up"
  | "courier_to_client"
  | "delivered"
  | "delivery_failed";

const deliveryStatuses: DeliveryDashboardStatus[] = [
  "delivery_pending",
  "courier_assigned",
  "courier_accepted",
  "courier_to_partner",
  "picked_up",
  "courier_to_client",
  "delivered",
  "delivery_failed"
];

const statusVariant: Record<DeliveryDashboardStatus, BadgeVariant> = {
  delivery_pending: "muted",
  courier_assigned: "info",
  courier_accepted: "success",
  courier_to_partner: "warning",
  picked_up: "info",
  courier_to_client: "warning",
  delivered: "success",
  delivery_failed: "danger"
};

const deliveryOrders = getDeliveryOrders();
const activeDeliveries = deliveryOrders.filter((order) => ["pending", "assigned", "picked_up", "delivering"].includes(order.deliveryStatus ?? "")).length;
const completedToday = deliveryOrders.filter((order) => order.deliveryStatus === "delivered").length;
const demoEarnings = completedToday * 180 + activeDeliveries * 90;

export default function CourierDashboardPage() {
  return (
    <CourierLayout status="online">
      <CourierOperationalFinalPanel context="overview" />
      <CourierIssueEscalationPanel context="overview" />

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Courier demo</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Кабинет курьера</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Demo dashboard для назначенных доставок, активного маршрута, истории, дохода и проблем.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium text-foreground">
          Demo courier cabinet. Реальная авторизация курьера, геолокация и смены будут подключены позже.
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Профиль курьера</CardTitle>
                <CardDescription>Demo summary без auth и реальной геолокации.</CardDescription>
              </div>
              <Badge variant="success">online</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Info label="Имя" value="Demo Courier" />
            <Info label="Транспорт" value="auto / bike demo" />
            <Info label="Локация" value="Чолпон-Ата" />
            <Info label="Рейтинг" value="4.9" />
          </CardContent>
        </Card>

        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Availability status</CardTitle>
            <CardDescription>Courier availability statuses demo.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {["online", "busy", "paused", "offline"].map((status) => (
              <div className="flex items-center justify-between rounded-md border border-border bg-background p-3" key={status}>
                <span className="text-sm font-semibold text-foreground">{status}</span>
                <Badge variant={status === "online" ? "success" : status === "busy" ? "warning" : status === "paused" ? "info" : "muted"}>
                  {status === "online" ? "active" : "demo"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Новые доставки" value={deliveryOrders.filter((order) => order.deliveryStatus === "pending").length} />
        <StatCard label="Активные доставки" value={activeDeliveries} />
        <StatCard label="Завершено сегодня" value={completedToday} />
        <StatCard label="Доход demo" value={`${demoEarnings} KGS`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Быстрые действия</CardTitle>
            <CardDescription>Переходы будут активны после создания следующих courier pages.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <ActionLink href="/courier/deliveries" label="Открыть доставки" />
            <ActionLink href="/courier/active" label="Активная доставка" />
            <ActionLink href="/courier/history" label="История" variant="outline" />
            <ActionLink href="/courier/issues" label="Сообщить о проблеме" variant="outline" />
          </CardContent>
        </Card>

        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>AI dispatcher</CardTitle>
            <CardDescription>
              AI-диспетчер помогает назначать курьеров, отслеживать задержки и поднимать проблемы админу.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Info label="Assignment mode" value="recommendation demo" />
            <Info label="Escalation" value="human admin approval" />
            <Info label="Limits" value="no payment/status/legal changes" />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Delivery statuses</CardTitle>
          <CardDescription>Statuses from delivery architecture docs shown on dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {deliveryStatuses.map((status) => (
            <Badge key={status} variant={statusVariant[status]}>{status}</Badge>
          ))}
        </CardContent>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardHeader>
          <CardTitle>Правила доставки</CardTitle>
          <CardDescription>Курьер отвечает за физическую доставку после назначения.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {[
            "Курьер отвечает за физическую доставку после назначения.",
            "Курьер не меняет payment status.",
            "Курьер не отменяет заказ без админа.",
            "Курьер не включает alcohol delivery."
          ].map((rule) => (
            <div className="rounded-md border border-border bg-surface p-3 text-sm font-medium text-foreground" key={rule}>
              {rule}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Последние delivery orders</CardTitle>
          <CardDescription>Demo список заказов с доставкой из mockOrders.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {deliveryOrders.map((order, index) => {
            const status = mapDeliveryStatus(order.deliveryStatus);

            return (
              <div className="rounded-lg border border-border bg-background p-4" key={order.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">
                      {order.type === "food" ? "Доставка еды" : "Доставка магазина"} #{index + 1}
                    </p>
                    <p className="mt-1 text-sm text-muted">{order.id} · {new Date(order.createdAt).toLocaleString("ru-RU")}</p>
                  </div>
                  <Badge variant={statusVariant[status]}>{status}</Badge>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <Info label="Pickup" value={order.businessId} />
                  <Info label="Client" value={`Client demo ${order.clientUserId.replace("client-", "")}`} />
                  <Info label="Total" value={`${order.total} ${order.currency}`} />
                </div>
              </div>
            );
          })}
        </CardContent>
        <CardFooter>
          <ActionLink href="/courier/deliveries" label="Открыть доставки" />
        </CardFooter>
      </Card>
    </CourierLayout>
  );
}

function mapDeliveryStatus(status: string | undefined): DeliveryDashboardStatus {
  if (status === "assigned") {
    return "courier_assigned";
  }

  if (status === "picked_up") {
    return "picked_up";
  }

  if (status === "delivered") {
    return "delivered";
  }

  if (status === "cancelled") {
    return "delivery_failed";
  }

  return "delivery_pending";
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="text-3xl font-semibold text-primary">{value}</p>
        <Badge variant="muted">courier demo</Badge>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ActionLink({ href, label, variant = "primary" }: { href: string; label: string; variant?: "primary" | "outline" }) {
  return (
    <a
      className={
        variant === "primary"
          ? "inline-flex min-h-11 items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          : "inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary"
      }
      href={href}
    >
      {label}
    </a>
  );
}

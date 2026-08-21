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

const deliveryStatuses: Array<{ status: DeliveryDashboardStatus; label: string }> = [
  { status: "delivery_pending", label: "Ожидает назначения" },
  { status: "courier_assigned", label: "Курьер назначен" },
  { status: "courier_accepted", label: "Задание принято" },
  { status: "courier_to_partner", label: "К партнёру" },
  { status: "picked_up", label: "Заказ получен" },
  { status: "courier_to_client", label: "К клиенту" },
  { status: "delivered", label: "Доставлено" },
  { status: "delivery_failed", label: "Проблема доставки" }
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

export default function CourierDashboardPage() {
  const deliveryOrders = getDeliveryOrders();
  const newDeliveries = deliveryOrders.filter((order) => order.deliveryStatus === "pending").length;
  const activeDeliveries = deliveryOrders.filter((order) => ["assigned", "picked_up", "delivering"].includes(order.deliveryStatus ?? "")).length;
  const completedDeliveries = deliveryOrders.filter((order) => order.deliveryStatus === "delivered").length;
  const problemDeliveries = deliveryOrders.filter((order) => order.deliveryStatus === "cancelled").length;

  return (
    <CourierLayout status="online">
      <CourierOperationalFinalPanel context="overview" />
      <CourierIssueEscalationPanel context="overview" />

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">KÖL Courier</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Кабинет курьера</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Назначенные доставки, активный маршрут, история и проблемы — в одном рабочем интерфейсе.
          </p>
        </div>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Новые доставки" value={newDeliveries} tone="info" />
        <StatCard label="В работе" value={activeDeliveries} tone="warning" />
        <StatCard label="Завершено" value={completedDeliveries} tone="success" />
        <StatCard label="Требуют внимания" value={problemDeliveries} tone={problemDeliveries > 0 ? "danger" : "success"} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Быстрые действия</CardTitle>
            <CardDescription>Основные рабочие разделы курьера.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <ActionLink href="/courier/deliveries" label="Все доставки" />
            <ActionLink href="/courier/active" label="Активная доставка" />
            <ActionLink href="/courier/history" label="История" variant="outline" />
            <ActionLink href="/courier/issues" label="Сообщить о проблеме" variant="outline" />
          </CardContent>
        </Card>

        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>AI-диспетчер</CardTitle>
            <CardDescription>
              Помогает распределять задачи, замечать задержки и передавать проблемные случаи оператору.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Info label="Назначение" value="Рекомендация и операционный контроль" />
            <Info label="Проблемы" value="Эскалация администратору" />
            <Info label="Финансы" value="Не изменяются курьерским контуром" />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Этапы доставки</CardTitle>
          <CardDescription>Понятный маршрут заказа от назначения до вручения клиенту.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {deliveryStatuses.map(({ label, status }) => (
            <Badge key={status} variant={statusVariant[status]}>{label}</Badge>
          ))}
        </CardContent>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardHeader>
          <CardTitle>Правила операционного контура</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Rule>Курьер меняет только разрешённые этапы своей назначенной доставки.</Rule>
          <Rule>Платёжный статус не зависит от курьерских действий.</Rule>
          <Rule>Проблемная доставка передаётся администратору.</Rule>
          <Rule>Завершение доставки фиксируется отдельным статусом.</Rule>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Последние доставки</CardTitle>
          <CardDescription>Текущая операционная лента заказов с доставкой.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {deliveryOrders.slice(0, 6).map((order, index) => {
            const status = mapDeliveryStatus(order.deliveryStatus);
            const label = deliveryStatuses.find((item) => item.status === status)?.label ?? status;

            return (
              <div className="rounded-lg border border-border bg-background p-4" key={order.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">
                      {order.type === "food" ? "Доставка еды" : "Доставка магазина"} #{index + 1}
                    </p>
                    <p className="mt-1 text-sm text-muted">{order.id}</p>
                  </div>
                  <Badge variant={statusVariant[status]}>{label}</Badge>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Info label="Сумма заказа" value={`${order.total} ${order.currency}`} />
                  <Info label="Создан" value={new Date(order.createdAt).toLocaleString("ru-RU")} />
                </div>
              </div>
            );
          })}
          {deliveryOrders.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-background p-5 text-sm text-muted">
              Назначенных доставок пока нет.
            </div>
          ) : null}
        </CardContent>
        <CardFooter>
          <ActionLink href="/courier/deliveries" label="Открыть доставки" />
        </CardFooter>
      </Card>
    </CourierLayout>
  );
}

function mapDeliveryStatus(status: string | undefined): DeliveryDashboardStatus {
  if (status === "assigned") return "courier_assigned";
  if (status === "picked_up") return "picked_up";
  if (status === "delivering") return "courier_to_client";
  if (status === "delivered") return "delivered";
  if (status === "cancelled") return "delivery_failed";
  return "delivery_pending";
}

function StatCard({ label, value, tone }: { label: string; value: string | number; tone: BadgeVariant }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="text-3xl font-semibold text-primary">{value}</p>
        <Badge variant={tone}>KÖL Courier</Badge>
      </CardContent>
    </Card>
  );
}

function Rule({ children }: { children: string }) {
  return <div className="rounded-md border border-border bg-surface p-3 text-sm font-medium text-foreground">{children}</div>;
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

import type { ReactNode } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getAdminBookings, getAdminDashboardData, getAdminDeliveryRisks, getAdminOrders } from "@/lib/data/admin";
import { getPartners } from "@/lib/data/partners";

type RiskTone = "low" | "medium" | "high" | "critical";

const riskVariant: Record<RiskTone, BadgeVariant> = {
  low: "success",
  medium: "warning",
  high: "danger",
  critical: "danger"
};

const quickActions = [
  { label: "Заказы", href: "/admin/orders" },
  { label: "Бронирования", href: "/admin/bookings" },
  { label: "Доставки", href: "/admin/delivery" },
  { label: "Партнёры и каталог", href: "/admin/catalog" },
  { label: "Модерация", href: "/admin/moderation" },
  { label: "Финансы", href: "/admin/finance" },
  { label: "AI-диспетчер", href: "/admin/ai-dispatcher" }
];

export default function AdminDashboardPage() {
  const dashboard = getAdminDashboardData();
  const orders = getAdminOrders();
  const bookings = getAdminBookings();
  const partners = getPartners();
  const deliveryRisks = getAdminDeliveryRisks();
  const deliveriesInWork = orders.filter((order) => ["assigned", "picked_up", "delivering"].includes(order.deliveryStatus ?? "")).length;
  const problemsNeedAttention = deliveryRisks.filter((risk) => risk.riskLevel === "high" || risk.riskLevel === "critical").length;

  return (
    <AdminLayout status={problemsNeedAttention > 0 ? "attention" : "stable"}>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">KÖL Admin</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Единый операционный центр</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Заказы, бронирования, доставки, партнёры, модерация, финансы и контроль рисков — в одном кабинете.
          </p>
        </div>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Активные заказы" value={dashboard.activeOrdersCount} tone="info" />
        <StatCard label="Активные брони" value={dashboard.activeBookingsCount} tone="success" />
        <StatCard label="Доставки в работе" value={deliveriesInWork} tone="warning" />
        <StatCard label="Партнёры" value={dashboard.partnersCount} tone="info" />
        <StatCard label="Требуют внимания" value={problemsNeedAttention} tone={problemsNeedAttention > 0 ? "danger" : "success"} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Быстрые действия</CardTitle>
          <CardDescription>Переход к ключевым рабочим разделам без лишней навигации.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {quickActions.map((action, index) => (
            <ActionLink href={action.href} key={action.href} variant={index < 2 ? "primary" : "outline"}>
              {action.label}
            </ActionLink>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Последние заказы</CardTitle>
              <CardDescription>Оперативная лента Food и Shop заказов.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {orders.slice(0, 4).map((order) => (
                <div className="rounded-lg border border-border bg-background p-4" key={order.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{order.type === "food" ? "Заказ еды" : "Заказ магазина"}</p>
                      <p className="text-sm text-muted">{order.id}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={order.status === "completed" ? "success" : order.status === "cancelled" ? "danger" : "info"}>{order.status}</Badge>
                      <Badge variant="muted">{order.total} {order.currency}</Badge>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-muted">{order.items.map((item) => `${item.title} × ${item.quantity}`).join(", ")}</p>
                </div>
              ))}
              {orders.length === 0 ? <EmptyRow text="Заказов пока нет." /> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Последние бронирования</CardTitle>
              <CardDescription>Stay и Tours в единой операционной ленте.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {bookings.slice(0, 4).map((booking) => (
                <div className="rounded-lg border border-border bg-background p-4" key={booking.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{booking.title}</p>
                      <p className="text-sm text-muted">{booking.type === "tour" ? "Тур" : "Жильё"} · {booking.startDate}{booking.endDate ? ` — ${booking.endDate}` : ""}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={booking.status === "confirmed" ? "success" : booking.status === "pending" ? "warning" : "muted"}>{booking.status}</Badge>
                      <Badge variant="muted">{booking.total} {booking.currency}</Badge>
                    </div>
                  </div>
                </div>
              ))}
              {bookings.length === 0 ? <EmptyRow text="Бронирований пока нет." /> : null}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Партнёры</CardTitle>
              <CardDescription>Состояние подключённых бизнесов и сервисов.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {partners.slice(0, 5).map((partner) => (
                <div className="rounded-lg border border-border bg-background p-3" key={partner.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{partner.title}</p>
                      <p className="text-xs text-muted">{partner.type} · {partner.location}</p>
                    </div>
                    <Badge variant={partner.businessStatus === "online" ? "success" : partner.businessStatus === "paused" ? "warning" : "muted"}>
                      {partner.businessStatus}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-warning/40 bg-warning/10">
            <CardHeader>
              <CardTitle>Риски доставки</CardTitle>
              <CardDescription>Ситуации, которые требуют внимания оператора.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {deliveryRisks.map((risk) => (
                <div className="rounded-lg border border-border bg-surface p-3" key={risk.orderId}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-foreground">{risk.orderId}</p>
                    <Badge variant={riskVariant[risk.riskLevel]}>{risk.riskLevel}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted">{risk.reason}</p>
                </div>
              ))}
              {deliveryRisks.length === 0 ? <EmptyRow text="Критических рисков сейчас нет." /> : null}
            </CardContent>
          </Card>
        </aside>
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>AI-диспетчер</CardTitle>
            <CardDescription>
              Анализирует задержки и операционные риски, формирует рекомендации и передаёт критические решения человеку.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Rule>Оплата и финансовый статус не меняются AI-модулем.</Rule>
            <Rule>Критические действия требуют подтверждения оператора.</Rule>
            <Rule>Рекомендации строятся только на данных платформы.</Rule>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Контроль и безопасность</CardTitle>
            <CardDescription>Ключевые ограничения операционного контура.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Rule>Транзакционные статусы меняются только через разрешённые серверные операции.</Rule>
            <Rule>Платёжные события отделены от доставки и операционных действий.</Rule>
            <Rule>Критические изменения должны оставлять историю и проходить проверку прав.</Rule>
          </CardContent>
        </Card>
      </section>
    </AdminLayout>
  );
}

function StatCard({ label, tone, value }: { label: string; tone: BadgeVariant; value: number | string }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="text-3xl font-semibold text-primary">{value}</p>
        <Badge variant={tone}>KÖL Admin</Badge>
      </CardContent>
    </Card>
  );
}

function Rule({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-border bg-surface p-3 text-sm font-medium text-foreground">{children}</div>;
}

function EmptyRow({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted">{text}</div>;
}

function ActionLink({ children, href, variant = "primary" }: { children: ReactNode; href: string; variant?: "primary" | "outline" }) {
  return (
    <a
      className={
        variant === "primary"
          ? "inline-flex min-h-11 items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          : "inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary"
      }
      href={href}
    >
      {children}
    </a>
  );
}

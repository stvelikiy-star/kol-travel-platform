import type { ReactNode } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
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
  { label: "Открыть заказы", href: "/admin/orders" },
  { label: "Проверить доставки", href: "/admin/delivery" },
  { label: "AI-диспетчер", href: "/admin/ai-dispatcher" },
  { label: "Модерация", href: "/admin/moderation" },
  { label: "Финансы", href: "/admin/finance" }
];

const deliveryRisks: Array<{ label: string; description: string; risk: RiskTone }> = [
  { label: "no courier", description: "Готовый заказ ожидает курьера дольше нормы.", risk: "high" },
  { label: "courier delay", description: "Курьер назначен, но движение или подтверждение задержаны.", risk: "medium" },
  { label: "partner delay", description: "Партнёр дольше ожидаемого не меняет preparation status.", risk: "medium" },
  { label: "client issue", description: "Клиент недоступен или адрес требует уточнения.", risk: "critical" }
];

const operationalRules = [
  "Admin can manually assign/reassign couriers demo.",
  "Admin can resolve delivery problems demo.",
  "Admin can moderate partners/catalog demo.",
  "Admin controls disputes demo.",
  "Admin approves high-risk AI suggestions demo."
];

const safetyRules = [
  "AI never changes payment status.",
  "AI never cancels order without human approval.",
  "Alcohol module remains OFF.",
  "Accepted orders/bookings require admin rules before cancellation."
];

export default function AdminDashboardPage() {
  const dashboard = getAdminDashboardData();
  const orders = getAdminOrders();
  const bookings = getAdminBookings();
  const partners = getPartners();
  const deliveryRisks = getAdminDeliveryRisks();
  const activeOrders = dashboard.activeOrdersCount;
  const activeBookings = dashboard.activeBookingsCount;
  const deliveriesInWork = orders.filter((order) => ["assigned", "picked_up", "delivering"].includes(order.deliveryStatus ?? "")).length;
  const partnersTotal = dashboard.partnersCount;
  const couriersOnline = 3;
  const problemsNeedAttention = deliveryRisks.filter((risk) => risk.riskLevel === "high" || risk.riskLevel === "critical").length;

  return (
    <AdminLayout status="attention">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Admin demo</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Админ-панель KÖL</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Операционный overview для заказов, броней, доставок, партнёров, курьеров, модерации и AI-диспетчера.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium text-foreground">
          Demo admin panel. Реальные роли, авторизация, база данных и CRM будут подключены позже.
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Активные заказы" value={activeOrders} tone="info" />
        <StatCard label="Активные брони" value={activeBookings} tone="success" />
        <StatCard label="Доставки в работе" value={deliveriesInWork} tone="warning" />
        <StatCard label="Партнёры" value={partnersTotal} tone="info" />
        <StatCard label="Курьеры онлайн" value={couriersOnline} tone="success" />
        <StatCard label="Проблемы требуют внимания" value={problemsNeedAttention} tone="danger" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
          <CardDescription>Быстрые переходы к будущим admin CRM-разделам.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {quickActions.map((action, index) => (
            <ActionLink href={action.href} key={action.href} variant={index === 0 ? "primary" : "outline"}>
              {action.label}
            </ActionLink>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent orders</CardTitle>
              <CardDescription>Последние demo-заказы из mockOrders.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {orders.slice(0, 4).map((order) => (
                <div className="rounded-lg border border-border bg-background p-4" key={order.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{order.id}</p>
                      <p className="text-sm text-muted">{order.type} · {order.businessId}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={order.status === "completed" ? "success" : order.status === "cancelled" ? "danger" : "info"}>{order.status}</Badge>
                      <Badge variant="muted">{order.total} {order.currency}</Badge>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-muted">{order.items.map((item) => `${item.title} x${item.quantity}`).join(", ")}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent bookings</CardTitle>
              <CardDescription>Последние demo-брони из mockBookings.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {bookings.slice(0, 4).map((booking) => (
                <div className="rounded-lg border border-border bg-background p-4" key={booking.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{booking.title}</p>
                      <p className="text-sm text-muted">{booking.type} · {booking.startDate}{booking.endDate ? ` - ${booking.endDate}` : ""}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={booking.status === "confirmed" ? "success" : booking.status === "pending" ? "warning" : "muted"}>{booking.status}</Badge>
                      <Badge variant="muted">{booking.total} {booking.currency}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Partner status overview</CardTitle>
              <CardDescription>Сводка партнёров из mockPartners.</CardDescription>
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
              <CardTitle>Delivery risk overview</CardTitle>
              <CardDescription>Demo-контроль рисков доставки.</CardDescription>
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
            </CardContent>
          </Card>
        </aside>
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>AI admin</CardTitle>
            <CardDescription>
              AI-диспетчер помогает отслеживать зависшие заказы, задержки, курьеров и риски, но не отменяет заказы и не меняет оплату без человека.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Rule>AI only recommends actions in demo mode.</Rule>
            <Rule>High-risk suggestions require admin approval.</Rule>
            <Rule>AI never enables alcohol delivery.</Rule>
          </CardContent>
        </Card>

        <Card className="border-danger/30 bg-danger/10">
          <CardHeader>
            <CardTitle>Admin operational rules</CardTitle>
            <CardDescription>Ограничения и полномочия admin demo panel.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {operationalRules.map((rule) => (
              <Rule key={rule}>{rule}</Rule>
            ))}
            {safetyRules.map((rule) => (
              <Rule key={rule}>{rule}</Rule>
            ))}
          </CardContent>
          <CardFooter>
            <Button variant="outline">Approve high-risk demo</Button>
            <Button variant="danger">Escalate incident demo</Button>
          </CardFooter>
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
        <Badge variant={tone}>admin demo</Badge>
      </CardContent>
    </Card>
  );
}

function Rule({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-border bg-surface p-3 text-sm font-medium text-foreground">{children}</div>;
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

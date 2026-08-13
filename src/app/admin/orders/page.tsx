import type { ReactNode } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getAdminOrders } from "@/lib/data/admin";
import type { DeliveryStatus, OrderStatus, PaymentStatus } from "@/types";

type RiskLevel = "low" | "medium" | "high" | "critical";

const filters = ["Все", "Новые", "Принятые", "Готовятся", "Готовы к выдаче", "В доставке", "Завершённые", "Проблемные"];

const statusVariant: Record<string, BadgeVariant> = {
  new: "info",
  accepted: "success",
  preparing: "warning",
  assembling: "warning",
  ready: "info",
  delivering: "warning",
  completed: "success",
  rejected: "danger",
  cancelled: "danger",
  pending: "muted",
  assigned: "info",
  picked_up: "warning",
  delivered: "success"
};

const riskVariant: Record<RiskLevel, BadgeVariant> = {
  low: "success",
  medium: "warning",
  high: "danger",
  critical: "danger"
};

export default function AdminOrdersPage() {
  const orders = getAdminOrders();
  const newOrders = orders.filter((order) => order.status === "new").length;
  const inWork = orders.filter((order) => ["accepted", "preparing", "assembling"].includes(order.status)).length;
  const ready = orders.filter((order) => order.status === "ready").length;
  const delivery = orders.filter((order) => ["assigned", "picked_up", "delivering"].includes(order.deliveryStatus ?? "")).length;
  const problem = orders.filter((order) => ["cancelled", "rejected"].includes(order.status) || order.paymentStatus === "pending").length;

  return (
    <AdminLayout status="attention">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Admin CRM</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Заказы</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Demo control page для мониторинга заказов, статусов партнёров, оплаты, доставки и операционных рисков.
          </p>
        </div>
      </Card>

      <DemoAlert />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Новые" value={newOrders} tone="info" />
        <StatCard label="В работе" value={inWork} tone="warning" />
        <StatCard label="Готовы к выдаче" value={ready} tone="info" />
        <StatCard label="Доставка" value={delivery} tone="success" />
        <StatCard label="Проблемные" value={problem} tone="danger" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Фильтры</CardTitle>
          <CardDescription>UI-only фильтры для будущей admin order CRM.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {filters.map((filter, index) => (
            <Button key={filter} variant={index === 0 ? "primary" : "outline"}>
              {filter}
            </Button>
          ))}
        </CardContent>
      </Card>

      <section className="grid gap-4">
        {orders.map((order, index) => {
          const risk = getOrderRisk(order.paymentStatus, order.deliveryStatus, order.status, index);

          return (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{order.id}</CardTitle>
                    <CardDescription>{order.type} order · client demo {order.clientUserId.replace("client-", "")}</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={statusVariant[order.status] ?? "muted"}>{order.status}</Badge>
                    <Badge variant={riskVariant[risk]}>{risk} risk</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <Info label="Partner demo" value={order.businessId} />
                  <Info label="Order type" value={order.type} />
                  <Info label="Total" value={`${order.total} ${order.currency}`} />
                  <Info label="Payment method" value={order.paymentStatus} />
                  <Info label="Delivery status demo" value={order.deliveryStatus ?? "no delivery"} />
                  <Info label="Created date" value={order.createdAt} />
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  <p className="text-sm font-semibold text-foreground">Items preview</p>
                  <p className="mt-2 text-sm text-muted">
                    {order.items.map((item) => `${item.title} x${item.quantity}`).join(", ")}
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Button>Открыть детали demo</Button>
                <Button variant="outline">Назначить курьера demo</Button>
                <Button variant="outline">Связаться с партнёром demo</Button>
                <Button variant="outline">Связаться с клиентом demo</Button>
                <Button variant="danger">Поднять проблему demo</Button>
              </CardFooter>
            </Card>
          );
        })}
      </section>

      <RulesCard
        title="Admin order rules"
        items={[
          "Admin can resolve disputes demo.",
          "Admin can reassign courier demo.",
          "Admin cannot change payment status without rules.",
          "Alcohol module remains OFF."
        ]}
      />
    </AdminLayout>
  );
}

function getOrderRisk(payment: PaymentStatus, delivery: DeliveryStatus | undefined, status: OrderStatus, index: number): RiskLevel {
  if (status === "cancelled" || delivery === "cancelled") return "critical";
  if (payment === "pending" && delivery === "pending") return "high";
  if (index % 2 === 1 || delivery === "assigned") return "medium";
  return "low";
}

function DemoAlert() {
  return (
    <Card className="border-warning/40 bg-warning/10">
      <CardContent className="p-4 text-sm font-medium text-foreground">
        Demo admin panel. Реальные роли, авторизация, база данных и CRM будут подключены позже.
      </CardContent>
    </Card>
  );
}

function StatCard({ label, tone, value }: { label: string; tone: BadgeVariant; value: string | number }) {
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </div>
  );
}

function RulesCard({ items, title }: { items: string[]; title: string }) {
  return (
    <Card className="border-warning/40 bg-warning/10">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {items.map((item) => (
          <div className="rounded-md border border-warning/30 bg-surface p-3 text-sm font-medium text-foreground" key={item}>
            {item}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

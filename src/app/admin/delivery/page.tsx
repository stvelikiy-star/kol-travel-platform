import { AdminLayout } from "@/components/layout/AdminLayout";
import { AdminDeliveryDemoActions } from "@/app/admin/delivery/AdminDeliveryDemoActions";
import { AdminDeliveryControlPanel } from "@/app/admin/delivery/_components/AdminDeliveryControlPanel";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getAdminDeliveryReadResult } from "@/lib/data/admin-delivery-read";

type RiskLevel = "low" | "medium" | "high" | "critical";

const filters = ["Все", "Без курьера", "Назначены", "Курьер едет к партнёру", "Забрал заказ", "В пути к клиенту", "Доставлено", "Проблемные"];
const aiSignals = ["partner delay", "no courier", "courier not accepted", "courier delay", "client not available", "admin required"];

const statusVariant: Record<string, BadgeVariant> = {
  pending: "warning",
  assigned: "info",
  picked_up: "warning",
  delivering: "warning",
  delivered: "success",
  cancelled: "danger"
};

const riskVariant: Record<RiskLevel, BadgeVariant> = {
  low: "success",
  medium: "warning",
  high: "danger",
  critical: "danger"
};

export default async function AdminDeliveryPage() {
  const readResult = await getAdminDeliveryReadResult();
  const deliveryOrders = readResult.orders;
  const noCourier = deliveryOrders.filter((order) => ["new", "preparing", "ready_for_pickup"].includes(order.status)).length;
  const assigned = deliveryOrders.filter((order) => ["courier_assigned", "assigned"].includes(order.status)).length;
  const inTransit = deliveryOrders.filter((order) => ["picked_up", "courier_to_client", "delivering"].includes(order.status)).length;
  const delays = deliveryOrders.filter((order) => order.paymentStatus === "pending").length;
  const problems = deliveryOrders.filter((order) => ["cancelled", "delivery_failed", "admin_required"].includes(order.status)).length;

  return (
    <AdminLayout status="attention">
      <AdminDeliveryControlPanel context="delivery" />

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Delivery control</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Контроль доставки</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Admin center для назначения курьеров, задержек, проблем доставки и AI dispatcher monitoring.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium text-foreground">
          Demo delivery control. Реальное назначение курьеров, уведомления и GPS будут подключены позже.
        </CardContent>
      </Card>

      <Card className="border-primary/15 bg-surface">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={readResult.source === "supabase" ? "warning" : readResult.source === "fallback" ? "muted" : "info"}>
              {readResult.source === "supabase"
                ? "Supabase read pilot"
                : readResult.source === "fallback"
                  ? "Fallback to mock data"
                  : "Mock data mode"}
            </Badge>
            {readResult.code ? <Badge variant="muted">{readResult.code}</Badge> : null}
          </div>
          <p className="text-sm leading-6 text-muted">
            {readResult.message ?? "Admin delivery data is loaded through the read wrapper."}
          </p>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Без курьера" value={noCourier} tone="warning" />
        <StatCard label="Назначены" value={assigned} tone="info" />
        <StatCard label="В пути" value={inTransit} tone="success" />
        <StatCard label="Задержки" value={delays} tone="danger" />
        <StatCard label="Проблемные" value={problems} tone="danger" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Фильтры доставки</CardTitle>
          <CardDescription>UI-only фильтры для future delivery control center.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {filters.map((filter, index) => (
            <Button key={filter} variant={index === 0 ? "primary" : "outline"}>
              {filter}
            </Button>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="grid gap-4">
          {deliveryOrders.map((order, index) => {
            const risk = getDeliveryRisk(order.status, index);

            return (
              <Card key={order.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>{order.id}</CardTitle>
                      <CardDescription>courier demo {index + 1} · client {order.clientId}</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={statusVariant[order.status] ?? "muted"}>{order.status}</Badge>
                      <Badge variant={riskVariant[risk]}>{risk} risk</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <Info label="order id" value={order.id} />
                    <Info label="business_id" value={order.businessId} />
                    <Info label="Partner" value={order.partnerTitle ?? order.businessId} />
                    <Info label="type" value={order.type} />
                    <Info label="status" value={order.status} />
                    <Info label="payment_status" value={order.paymentStatus} />
                    <Info label="total" value={`${order.total} KGS`} />
                    <Info label="updated_at" value={new Date(order.updatedAt).toLocaleString("ru-RU")} />
                    <Info label="Issue reason demo" value={risk === "critical" ? "admin_required" : risk === "high" ? "courier_delay" : "none"} />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button>Назначить курьера demo</Button>
                  <Button variant="outline">Переназначить курьера demo</Button>
                  <Button variant="outline">Связаться с курьером demo</Button>
                  <Button variant="outline">Связаться с партнёром demo</Button>
                  <Button variant="outline">Связаться с клиентом demo</Button>
                  <Button variant="danger">Закрыть проблему demo</Button>
                </CardFooter>
              </Card>
            );
          })}
        </section>

        <aside className="space-y-4">
          <AdminDeliveryDemoActions />

          <Card>
            <CardHeader>
              <CardTitle>AI dispatcher monitoring</CardTitle>
              <CardDescription>Сигналы, которые AI может подсветить админу.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {aiSignals.map((signal, index) => (
                <div className="rounded-lg border border-border bg-background p-3" key={signal}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-foreground">{signal}</span>
                    <Badge variant={index > 3 ? "danger" : index > 1 ? "warning" : "info"}>demo</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-danger/30 bg-danger/10">
            <CardHeader>
              <CardTitle>Delivery rules</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {[
                "AI can recommend actions.",
                "Human admin approves high-risk changes.",
                "AI never cancels orders.",
                "AI never changes payment status.",
                "Alcohol delivery remains OFF."
              ].map((rule) => (
                <div className="rounded-md border border-danger/20 bg-surface p-3 text-sm font-medium text-foreground" key={rule}>
                  {rule}
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </AdminLayout>
  );
}

function getDeliveryRisk(status: string | undefined, index: number): RiskLevel {
  if (status === "cancelled") return "critical";
  if (status === "pending" || status === "ready_for_pickup") return "high";
  if (index % 2 === 1 || status === "assigned" || status === "preparing") return "medium";
  return "low";
}

function StatCard({ label, tone, value }: { label: string; tone: BadgeVariant; value: string | number }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="text-3xl font-semibold text-primary">{value}</p>
        <Badge variant={tone}>delivery demo</Badge>
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

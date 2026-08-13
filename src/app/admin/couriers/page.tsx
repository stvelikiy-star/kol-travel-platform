import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { getDeliveries } from "@/lib/data/delivery";

type CourierStatus = "online" | "busy" | "paused" | "offline";
type RiskLevel = "low" | "medium" | "high";

const couriers: Array<{ name: string; phone: string; vehicle: string; status: CourierStatus; delivery: string; completed: number; risk: RiskLevel }> = [
  { name: "Courier A demo", phone: "+996 700 500 101", vehicle: "Авто", status: "online", delivery: "none", completed: 7, risk: "low" },
  { name: "Courier B demo", phone: "+996 700 500 202", vehicle: "Скутер", status: "busy", delivery: "order-shop-new", completed: 5, risk: "medium" },
  { name: "Courier C demo", phone: "+996 700 500 303", vehicle: "Авто", status: "paused", delivery: "none", completed: 3, risk: "low" },
  { name: "Courier D demo", phone: "+996 700 500 404", vehicle: "Пеший", status: "offline", delivery: "order-food-new", completed: 1, risk: "high" }
];

const statusVariant: Record<CourierStatus, BadgeVariant> = {
  online: "success",
  busy: "warning",
  paused: "info",
  offline: "muted"
};

const riskVariant: Record<RiskLevel, BadgeVariant> = {
  low: "success",
  medium: "warning",
  high: "danger"
};

export default function AdminCouriersPage() {
  const deliveries = getDeliveries();

  return (
    <AdminLayout status="attention">
      <PageHero title="Курьеры" description="Demo управление курьерами, статусами смен, назначениями и проблемами доставки." />
      <DemoAlert />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Онлайн" value={couriers.filter((courier) => courier.status === "online").length} tone="success" />
        <StatCard label="Заняты" value={couriers.filter((courier) => courier.status === "busy").length} tone="warning" />
        <StatCard label="На паузе" value={couriers.filter((courier) => courier.status === "paused").length} tone="info" />
        <StatCard label="Проблемные доставки" value={deliveries.filter((delivery) => delivery.status === "delivery_failed").length} tone="danger" />
      </section>

      <FilterCard />

      <section className="grid gap-4">
        {couriers.map((courier) => (
          <Card key={courier.name}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{courier.name}</CardTitle>
                  <CardDescription>{courier.phone} · {courier.vehicle}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={statusVariant[courier.status]}>{courier.status}</Badge>
                  <Badge variant={riskVariant[courier.risk]}>{courier.risk} risk</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <Info label="Active delivery demo" value={courier.delivery} />
              <Info label="Completed today" value={`${courier.completed}`} />
              <Info label="Vehicle type" value={courier.vehicle} />
            </CardContent>
            <CardFooter>
              <Button>Назначить delivery demo</Button>
              <Button variant="outline">Связаться demo</Button>
              <Button variant="outline">Поставить на паузу demo</Button>
              <Button variant="danger">Проверить проблему demo</Button>
            </CardFooter>
          </Card>
        ))}
      </section>

      <RulesCard />
    </AdminLayout>
  );
}

function PageHero({ description, title }: { description: string; title: string }) {
  return <Card className="overflow-hidden"><div className="bg-gradient-to-br from-slate-900 via-primary to-accent p-6 text-white"><Badge className="border-white/30 bg-white text-primary">Admin couriers</Badge><h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">{title}</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">{description}</p></div></Card>;
}

function DemoAlert() {
  return <Card className="border-warning/40 bg-warning/10"><CardContent className="p-4 text-sm font-medium text-foreground">Demo courier management. Реальные смены, геолокация и назначения будут подключены позже.</CardContent></Card>;
}

function FilterCard() {
  return <Card><CardHeader><CardTitle>Поиск курьеров</CardTitle><CardDescription>Demo search/filter UI для courier operations.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_160px]"><Input placeholder="Имя, телефон или delivery ID" /><Select defaultValue="all"><option value="all">Все статусы</option><option value="online">online</option><option value="busy">busy</option><option value="paused">paused</option><option value="offline">offline</option></Select><Button>Найти demo</Button></CardContent></Card>;
}

function StatCard({ label, tone, value }: { label: string; tone: BadgeVariant; value: string | number }) {
  return <Card><CardContent className="space-y-3 p-5"><p className="text-sm font-medium text-muted">{label}</p><p className="text-3xl font-semibold text-primary">{value}</p><Badge variant={tone}>courier demo</Badge></CardContent></Card>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-border bg-background p-3"><p className="text-xs font-medium text-muted">{label}</p><p className="mt-1 font-semibold text-foreground">{value}</p></div>;
}

function RulesCard() {
  return <Card className="border-danger/30 bg-danger/10"><CardHeader><CardTitle>Courier admin rules</CardTitle></CardHeader><CardContent className="grid gap-2">{["Courier does not change payment status.", "Courier cannot cancel order without admin.", "AI dispatcher can recommend reassignment but human admin approves high-risk actions.", "Alcohol delivery remains OFF."].map((rule) => <div className="rounded-md border border-danger/20 bg-surface p-3 text-sm font-medium text-foreground" key={rule}>{rule}</div>)}</CardContent></Card>;
}

import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { getAdminBookings, getAdminOrders } from "@/lib/data/admin";
import { getPartners } from "@/lib/data/partners";

export default function AdminPartnersPage() {
  const partners = getPartners();
  const adminOrders = getAdminOrders();
  const adminBookings = getAdminBookings();
  const active = partners.filter((partner) => partner.businessStatus === "online").length;
  const stopped = partners.filter((partner) => partner.businessStatus !== "online").length;

  return (
    <AdminLayout status="attention">
      <PageHero title="Партнёры" description="Demo управление партнёрами, статусами, каталогом, stop-кнопкой и модерацией." />
      <DemoAlert />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Всего партнёров" value={partners.length} tone="info" />
        <StatCard label="Активные" value={active} tone="success" />
        <StatCard label="На проверке" value={1} tone="warning" />
        <StatCard label="Остановленные demo" value={stopped} tone="danger" />
      </section>

      <FilterCard />

      <section className="grid gap-4">
        {partners.map((partner, index) => {
          const orders = adminOrders.filter((order) => order.businessId === partner.id).length;
          const bookings = adminBookings.filter((booking) => booking.businessId === partner.id).length;

          return (
            <Card key={partner.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{partner.title}</CardTitle>
                    <CardDescription>{partner.type} · {partner.location}</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={partner.status === "approved" ? "success" : "warning"}>{partner.status}</Badge>
                    <Badge variant={partner.businessStatus === "online" ? "success" : "warning"}>{partner.businessStatus}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <Info label="Rating demo" value={`${partner.rating}`} />
                <Info label="Orders demo" value={`${orders}`} />
                <Info label="Bookings demo" value={`${bookings}`} />
                <Info label="Stop status demo" value={index % 4 === 0 ? "limited" : "active"} />
              </CardContent>
              <CardFooter>
                <Button>Открыть кабинет demo</Button>
                <Button variant="outline">Проверить каталог demo</Button>
                <Button variant="danger">Остановить demo</Button>
                <Button variant="outline">Модерация demo</Button>
              </CardFooter>
            </Card>
          );
        })}
      </section>

      <RulesCard />
    </AdminLayout>
  );
}

function PageHero({ description, title }: { description: string; title: string }) {
  return <Card className="overflow-hidden"><div className="bg-gradient-to-br from-slate-900 via-primary to-accent p-6 text-white"><Badge className="border-white/30 bg-white text-primary">Admin partners</Badge><h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">{title}</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">{description}</p></div></Card>;
}

function DemoAlert() {
  return <Card className="border-warning/40 bg-warning/10"><CardContent className="p-4 text-sm font-medium text-foreground">Demo partner management. Реальная модерация, onboarding и catalog review будут подключены позже.</CardContent></Card>;
}

function FilterCard() {
  return <Card><CardHeader><CardTitle>Поиск партнёров</CardTitle><CardDescription>Demo search/filter UI.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_160px]"><Input placeholder="Название, город или тип партнёра" /><Select defaultValue="all"><option value="all">Все типы</option><option value="hotel">Отели</option><option value="food">Еда</option><option value="shop">Магазины</option><option value="tour">Туры</option></Select><Button>Найти demo</Button></CardContent></Card>;
}

function StatCard({ label, tone, value }: { label: string; tone: BadgeVariant; value: string | number }) {
  return <Card><CardContent className="space-y-3 p-5"><p className="text-sm font-medium text-muted">{label}</p><p className="text-3xl font-semibold text-primary">{value}</p><Badge variant={tone}>partner demo</Badge></CardContent></Card>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-border bg-background p-3"><p className="text-xs font-medium text-muted">{label}</p><p className="mt-1 font-semibold text-foreground">{value}</p></div>;
}

function RulesCard() {
  return <Card className="border-warning/40 bg-warning/10"><CardHeader><CardTitle>Partner admin rules</CardTitle></CardHeader><CardContent className="grid gap-2">{["Partner stop does not cancel accepted orders/bookings.", "Catalog moderation will be connected later.", "Alcohol module remains OFF by default."].map((rule) => <div className="rounded-md border border-warning/30 bg-surface p-3 text-sm font-medium text-foreground" key={rule}>{rule}</div>)}</CardContent></Card>;
}

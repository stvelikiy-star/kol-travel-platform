import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { getAdminBookings, getAdminOrders } from "@/lib/data/admin";

const orders = getAdminOrders();
const bookings = getAdminBookings();

const demoClients = ["client-001", "client-002", "client-003", "client-004"].map((id, index) => ({
  id,
  name: `Client demo ${index + 1}`,
  contact: `+996 700 10${index} 20${index} · client${index + 1}@kol.demo`,
  orders: orders.filter((order) => order.clientUserId === id).length,
  bookings: bookings.filter((booking) => booking.clientUserId === id).length,
  points: 400 + index * 175,
  status: index === 3 ? "attention" : "active"
}));

export default function AdminClientsPage() {
  return (
    <AdminLayout status="attention">
      <PageHero title="Клиенты" description="Demo управление клиентами, заказами, бронями, loyalty и поддержкой." />
      <DemoAlert />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Всего клиентов" value={demoClients.length} tone="info" />
        <StatCard label="Активные заказы" value={orders.filter((order) => !["completed", "cancelled"].includes(order.status)).length} tone="warning" />
        <StatCard label="Активные брони" value={bookings.filter((booking) => ["pending", "confirmed"].includes(booking.status)).length} tone="success" />
        <StatCard label="Loyalty points demo" value={demoClients.reduce((sum, client) => sum + client.points, 0)} tone="info" />
      </section>

      <FilterCard />

      <section className="grid gap-4">
        {demoClients.map((client) => (
          <Card key={client.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{client.name}</CardTitle>
                  <CardDescription>{client.contact}</CardDescription>
                </div>
                <Badge variant={client.status === "active" ? "success" : "warning"}>{client.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <Info label="Orders count" value={`${client.orders}`} />
              <Info label="Bookings count" value={`${client.bookings}`} />
              <Info label="Points" value={`${client.points}`} />
              <Info label="Client ID" value={client.id} />
            </CardContent>
            <CardFooter>
              <Button>Открыть профиль demo</Button>
              <Button variant="outline">Посмотреть заказы demo</Button>
              <Button variant="outline">Посмотреть брони demo</Button>
              <Button variant="outline">Поддержка demo</Button>
            </CardFooter>
          </Card>
        ))}
      </section>
    </AdminLayout>
  );
}

function PageHero({ description, title }: { description: string; title: string }) {
  return <Card className="overflow-hidden"><div className="bg-gradient-to-br from-slate-900 via-primary to-accent p-6 text-white"><Badge className="border-white/30 bg-white text-primary">Admin clients</Badge><h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">{title}</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">{description}</p></div></Card>;
}

function DemoAlert() {
  return <Card className="border-warning/40 bg-warning/10"><CardContent className="p-4 text-sm font-medium text-foreground">Demo client management. Реальные профили, auth scope и персональные данные будут подключены позже.</CardContent></Card>;
}

function FilterCard() {
  return <Card><CardHeader><CardTitle>Поиск клиентов</CardTitle><CardDescription>Фильтры пока работают как UI demo.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_160px]"><Input placeholder="Имя, телефон или email" /><Select defaultValue="all"><option value="all">Все клиенты</option><option value="active">Активные</option><option value="attention">Требуют внимания</option></Select><Button>Найти demo</Button></CardContent></Card>;
}

function StatCard({ label, tone, value }: { label: string; tone: BadgeVariant; value: string | number }) {
  return <Card><CardContent className="space-y-3 p-5"><p className="text-sm font-medium text-muted">{label}</p><p className="text-3xl font-semibold text-primary">{value}</p><Badge variant={tone}>client demo</Badge></CardContent></Card>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-border bg-background p-3"><p className="text-xs font-medium text-muted">{label}</p><p className="mt-1 font-semibold text-foreground">{value}</p></div>;
}

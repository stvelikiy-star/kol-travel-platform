import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getAdminBookingsReadResult } from "@/lib/data/admin-bookings-read";
import { getAdminDeliveryReadResult } from "@/lib/data/admin-delivery-read";
import { getAdminPartnersReadResult } from "@/lib/data/admin-partners-read";

export default async function AdminPartnersPage() {
  const [partnersRead, ordersRead, bookingsRead] = await Promise.all([
    getAdminPartnersReadResult(),
    getAdminDeliveryReadResult(),
    getAdminBookingsReadResult()
  ]);
  const partners = partnersRead.partners;
  const orders = ordersRead.orders;
  const bookings = bookingsRead.bookings;
  const active = partners.filter((partner) => partner.businessStatus === "online").length;
  const review = partners.filter((partner) => partner.status === "pending").length;
  const stopped = partners.filter((partner) => partner.businessStatus !== "online" || ["suspended", "rejected", "archived"].includes(partner.status)).length;
  const readFailures = [partnersRead, ordersRead, bookingsRead].filter((result) => !result.ok && result.code !== "empty_result").length;

  return (
    <AdminLayout status={review > 0 || stopped > 0 || readFailures > 0 ? "attention" : "stable"}>
      <PageHero title="Партнёры" description="Партнёры, их фактический статус и операционная активность из административного RLS-контура." />

      {readFailures > 0 ? (
        <Card className="border-danger/40 bg-danger/10"><CardContent className="p-4 text-sm font-medium">Часть данных недоступна: {readFailures}. Страница не подставляет demo-метрики.</CardContent></Card>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Всего партнёров" value={partnersRead.ok || partnersRead.code === "empty_result" ? partners.length : "—"} tone="info" />
        <StatCard label="Онлайн" value={partnersRead.ok || partnersRead.code === "empty_result" ? active : "—"} tone="success" />
        <StatCard label="На проверке" value={partnersRead.ok || partnersRead.code === "empty_result" ? review : "—"} tone={review > 0 ? "warning" : "success"} />
        <StatCard label="Не активны" value={partnersRead.ok || partnersRead.code === "empty_result" ? stopped : "—"} tone={stopped > 0 ? "warning" : "success"} />
      </section>

      <section className="grid gap-4">
        {partners.map((partner) => {
          const partnerOrders = orders.filter((order) => order.businessId === partner.id).length;
          const partnerBookings = bookings.filter((booking) => booking.businessId === partner.id).length;
          return (
            <Card key={partner.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><CardTitle>{partner.title}</CardTitle><CardDescription>{partner.type} · {partner.location}</CardDescription></div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={partner.status === "approved" ? "success" : partner.status === "pending" ? "warning" : "danger"}>{partner.status}</Badge>
                    <Badge variant={partner.businessStatus === "online" ? "success" : partner.businessStatus === "paused" ? "warning" : "muted"}>{partner.businessStatus}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <Info label="Рейтинг" value={`${partner.rating}`} />
                <Info label="Заказы" value={ordersRead.ok || ordersRead.code === "empty_result" ? `${partnerOrders}` : "—"} />
                <Info label="Брони" value={bookingsRead.ok || bookingsRead.code === "empty_result" ? `${partnerBookings}` : "—"} />
                <Info label="Business status" value={partner.businessStatus} />
              </CardContent>
            </Card>
          );
        })}
        {!partners.length ? <EmptyRow text={partnersRead.ok || partnersRead.code === "empty_result" ? "Партнёров пока нет." : "Партнёры временно недоступны."} /> : null}
      </section>

      <Card>
        <CardHeader><CardTitle>Правила управления</CardTitle><CardDescription>Этот экран не выполняет stop/moderation действия сам. Такие изменения должны идти через отдельные серверные операции с проверкой роли и аудитом.</CardDescription></CardHeader>
        <CardContent className="grid gap-2">
          <Rule>Остановка партнёра не должна автоматически отменять уже принятые заказы и брони.</Rule>
          <Rule>Каталог и модерация используют собственные scoped-контуры.</Rule>
          <Rule>Alcohol module остаётся выключенным.</Rule>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}

function PageHero({ description, title }: { description: string; title: string }) {
  return <Card className="overflow-hidden"><div className="bg-gradient-to-br from-slate-900 via-primary to-accent p-6 text-white"><Badge className="border-white/30 bg-white text-primary">Admin partners</Badge><h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">{title}</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">{description}</p></div></Card>;
}
function StatCard({ label, tone, value }: { label: string; tone: BadgeVariant; value: string | number }) {
  return <Card><CardContent className="space-y-3 p-5"><p className="text-sm font-medium text-muted">{label}</p><p className="text-3xl font-semibold text-primary">{value}</p><Badge variant={tone}>partner</Badge></CardContent></Card>;
}
function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-border bg-background p-3"><p className="text-xs font-medium text-muted">{label}</p><p className="mt-1 break-all font-semibold text-foreground">{value}</p></div>;
}
function Rule({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-border bg-background p-3 text-sm font-medium">{children}</div>;
}
function EmptyRow({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted">{text}</div>;
}

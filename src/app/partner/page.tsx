import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerIssueEscalationPanel } from "@/app/partner/_components/PartnerIssueEscalationPanel";
import { PartnerWarningCard } from "@/components/partner/PartnerWarningCard";
import { BookingStatusBadge } from "@/components/status/BookingStatusBadge";
import { OrderStatusBadge } from "@/components/status/OrderStatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getPartnerBookings } from "@/lib/data/bookings";
import { getPartnerOrders } from "@/lib/data/orders";
import { getPartners } from "@/lib/data/partners";

export default function PartnerDashboardPage() {
  const partners = getPartners();
  const orders = getPartnerOrders();
  const bookings = getPartnerBookings();
  const partner = partners[2] ?? partners[0];
  const partnerOrders = orders.slice(0, 3);
  const partnerBookings = bookings.slice(0, 3);
  const newOrders = orders.filter((order) => ["new", "accepted", "preparing", "assembling"].includes(order.status)).length;
  const activeBookings = bookings.filter((booking) => ["pending", "confirmed", "checked_in"].includes(booking.status)).length;
  const waitingDeliveries = orders.filter((order) => ["preparing", "assembling", "ready", "delivering"].includes(order.status)).length;
  const demoRevenue = orders.reduce((sum, order) => sum + order.total, 0) + bookings.reduce((sum, booking) => sum + booking.total, 0);

  return (
    <PartnerLayout>
      <PartnerIssueEscalationPanel context="overview" />

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Partner demo</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Кабинет партнёра</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Demo dashboard для заказов, броней, каталога, доступности, финансов и stop-кнопки.
            Реальная авторизация и business scope будут подключены позже.
          </p>
        </div>
      </Card>

      <PartnerWarningCard
        description="Demo cabinet без авторизации. Партнёр видит только свой бизнес; backend и RLS будут подключены позже."
        title="Demo режим"
        tone="info"
      />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Профиль партнёра</CardTitle>
              <CardDescription>Demo summary бизнеса, который партнёр будет видеть после авторизации.</CardDescription>
            </div>
            <Badge variant={partner?.businessStatus === "online" ? "success" : "warning"}>
              {partner?.businessStatus ?? "online"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Бизнес" value={partner?.title ?? "Demo Partner"} />
          <Info label="Тип" value={partner?.type ?? "restaurant"} />
          <Info label="Локация" value={partner?.location ?? "Иссык-Куль"} />
          <Info label="Рейтинг" value={`${partner?.rating ?? "4.8"}`} />
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Новые заказы" value={newOrders} hint="food/shop demo" />
        <StatCard label="Активные брони" value={activeBookings} hint="stay/tour demo" />
        <StatCard label="Доставки ожидают" value={waitingDeliveries} hint="ready/delivery demo" />
        <StatCard label="Выручка demo" value={`${demoRevenue} KGS`} hint="manual MVP" />
        <StatCard label="Рейтинг" value={partner?.rating ?? "4.8"} hint={partner?.title ?? "Demo partner"} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Быстрые действия</CardTitle>
            <CardDescription>Основные операционные переходы партнёра.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <ActionLink href="/partner/orders" label="Открыть заказы" />
            <ActionLink href="/partner/bookings" label="Управлять бронями" />
            <ActionLink href="/partner/catalog" label="Каталог" variant="outline" />
            <ActionLink href="/partner/delivery" label="Доставка" variant="outline" />
            <ActionLink href="/partner/stop" label="Стоп-кнопка" variant="outline" />
          </CardContent>
        </Card>

        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Операционный статус</CardTitle>
            <CardDescription>Текущее demo-состояние бизнеса в платформе.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <Info label="Business active" value={partner?.businessStatus === "online" ? "active" : "paused"} />
            <Info label="Delivery active" value="active demo" />
            <Info label="Booking active" value="active demo" />
          </CardContent>
        </Card>
      </section>

      <PartnerWarningCard
        description="Стоп-кнопка не отменяет уже принятые заказы и брони. Она блокирует только новые заявки или выбранный scope."
        title="Важное про стоп-кнопку"
        tone="warning"
      />

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Последние заказы</CardTitle>
            <CardDescription>3 последних demo-заказа из mockOrders.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {partnerOrders.map((order) => (
              <div className="rounded-lg border border-border bg-background p-4" key={order.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{order.type === "food" ? "Заказ еды" : "Заказ магазина"}</p>
                    <p className="text-sm text-muted">{order.id}</p>
                  </div>
                  <OrderStatusBadge status={order.status} />
                </div>
                <p className="mt-3 text-sm text-muted">
                  {order.total} {order.currency} · {new Date(order.createdAt).toLocaleDateString("ru-RU")}
                </p>
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <ActionLink href="/partner/orders" label="Открыть заказы" />
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Последние брони</CardTitle>
            <CardDescription>3 последние demo-брони из mockBookings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {partnerBookings.map((booking) => (
              <div className="rounded-lg border border-border bg-background p-4" key={booking.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{booking.title}</p>
                    <p className="text-sm text-muted">{booking.type === "tour" ? "Тур" : "Жильё"}</p>
                  </div>
                  <BookingStatusBadge status={booking.status} />
                </div>
                <p className="mt-3 text-sm text-muted">
                  {booking.startDate}{booking.endDate ? ` - ${booking.endDate}` : ""} · {booking.total} {booking.currency}
                </p>
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <ActionLink href="/partner/bookings" label="Открыть брони" />
          </CardFooter>
        </Card>
      </section>
    </PartnerLayout>
  );
}

function StatCard({ hint, label, value }: { hint: string; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="text-3xl font-semibold text-primary">{value}</p>
        <Badge variant="muted">{hint}</Badge>
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

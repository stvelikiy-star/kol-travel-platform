import { ClientLayout } from "@/components/layout/ClientLayout";
import { BookingStatusBadge } from "@/components/status/BookingStatusBadge";
import { OrderStatusBadge } from "@/components/status/OrderStatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getClientBookings } from "@/lib/data/bookings";
import { getClientOrders } from "@/lib/data/orders";

export default function ClientCabinetPage() {
  const orders = getClientOrders();
  const bookings = getClientBookings();
  const activeOrders = orders.filter((order) => !["completed", "cancelled", "rejected"].includes(order.status));
  const activeBookings = bookings.filter((booking) => !["completed", "cancelled", "rejected", "no_show"].includes(booking.status));

  return (
    <ClientLayout>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary via-secondary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Demo cabinet</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Добро пожаловать в KÖL</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Единый клиентский dashboard для заказов, броней, баллов, скидок, избранного и поддержки. Реальная авторизация будет подключена позже.
          </p>
        </div>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Активные заказы" value={activeOrders.length} hint="Еда и магазин" />
        <StatCard label="Активные брони" value={activeBookings.length} hint="Туры и жильё" />
        <StatCard label="Баллы" value="1 240" hint="Demo balance" />
        <StatCard label="Доступные скидки" value="4" hint="Офферы и промокоды" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Быстрые действия</CardTitle>
            <CardDescription>Основные переходы клиента без лишнего поиска.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <ActionLink href="/client/orders" label="Все заказы" />
            <ActionLink href="/client/bookings" label="Все брони" />
            <ActionLink href="/tours" label="Найти тур" variant="outline" />
            <ActionLink href="/stays" label="Найти жильё" variant="outline" />
            <ActionLink href="/food" label="Заказать еду" />
            <ActionLink href="/client/support" label="Поддержка" variant="outline" />
          </CardContent>
        </Card>

        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Сезонный сценарий</CardTitle>
            <CardDescription>Планируйте отдых, сохраняйте понравившееся и возвращайтесь к заказам из кабинета.</CardDescription>
          </CardHeader>
          <CardFooter>
            <ActionLink href="/client/favorites" label="Открыть избранное" />
            <ActionLink href="/client/offers" label="Смотреть офферы" variant="outline" />
          </CardFooter>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Последние заказы</CardTitle>
                <CardDescription>Две последние записи из mockOrders.</CardDescription>
              </div>
              <ActionLink compact href="/client/orders" label="Все заказы" variant="outline" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {orders.slice(0, 2).map((order) => (
              <a className="block rounded-lg border border-border bg-background p-4 transition hover:border-primary" href={`/client/orders/${order.id}`} key={order.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{order.type === "food" ? "Заказ еды" : "Заказ магазина"}</p>
                    <p className="text-sm text-muted">{order.id}</p>
                  </div>
                  <OrderStatusBadge status={order.status} />
                </div>
                <p className="mt-3 text-sm text-muted">
                  {order.total} {order.currency} · {new Date(order.createdAt).toLocaleDateString("ru-RU")}
                </p>
              </a>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Последние брони</CardTitle>
                <CardDescription>Две последние записи из mockBookings.</CardDescription>
              </div>
              <ActionLink compact href="/client/bookings" label="Все брони" variant="outline" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {bookings.slice(0, 2).map((booking) => (
              <a className="block rounded-lg border border-border bg-background p-4 transition hover:border-primary" href={`/client/bookings/${booking.id}`} key={booking.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{booking.title}</p>
                    <p className="text-sm text-muted">{booking.type === "tour" ? "Тур" : "Жильё"}</p>
                  </div>
                  <BookingStatusBadge status={booking.status} />
                </div>
                <p className="mt-3 text-sm text-muted">
                  {booking.startDate}{booking.endDate ? ` - ${booking.endDate}` : ""} · {booking.total} {booking.currency}
                </p>
              </a>
            ))}
          </CardContent>
        </Card>
      </section>
    </ClientLayout>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
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

function ActionLink({
  compact,
  href,
  label,
  variant = "primary"
}: {
  compact?: boolean;
  href: string;
  label: string;
  variant?: "primary" | "outline";
}) {
  return (
    <a
      className={
        variant === "primary"
          ? `inline-flex min-h-11 items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 ${compact ? "" : "w-full"}`
          : `inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary ${compact ? "" : "w-full"}`
      }
      href={href}
    >
      {label}
    </a>
  );
}

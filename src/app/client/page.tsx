import { ClientLayout } from "@/components/layout/ClientLayout";
import { BookingStatusBadge } from "@/components/status/BookingStatusBadge";
import { OrderStatusBadge, type ExtendedOrderStatus } from "@/components/status/OrderStatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getClientBookings } from "@/lib/data/bookings";
import { readClientFavorites } from "@/lib/data/client-favorites-read";
import { readClientLoyalty } from "@/lib/data/client-loyalty-read";
import { getClientOrdersReadResult } from "@/lib/data/client-orders-read";

export default async function ClientCabinetPage() {
  const [ordersRead, favorites, loyalty] = await Promise.all([
    getClientOrdersReadResult(),
    readClientFavorites(),
    readClientLoyalty()
  ]);
  const isPreview = ordersRead.source === "mock" && favorites.source === "mock" && loyalty.source === "mock";
  const orders = ordersRead.source === "supabase" || isPreview ? ordersRead.orders : [];
  const bookings = isPreview ? getClientBookings() : [];
  const activeOrders = orders.filter((order) => !["completed", "cancelled", "rejected"].includes(order.status));
  const activeBookings = bookings.filter((booking) => !["completed", "cancelled", "rejected", "no_show"].includes(booking.status));
  const loyaltyValue = (loyalty.source === "supabase" || isPreview) && loyalty.balance !== null
    ? loyalty.balance.toLocaleString("ru-RU")
    : "—";
  const favoritesValue = (favorites.source === "supabase" || isPreview) && favorites.status === "ready"
    ? favorites.items.length
    : "—";

  return (
    <ClientLayout>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary via-secondary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">KÖL Client</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Личный кабинет</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Заказы, бронирования, избранное, предложения и поддержка — в одном аккаунте KÖL.
          </p>
        </div>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Активные заказы" value={activeOrders.length} hint="Еда и магазин" />
        <StatCard label="Активные брони" value={isPreview ? activeBookings.length : "—"} hint="Туры и жильё" />
        <StatCard label="Баллы" value={loyaltyValue} hint="Программа лояльности" />
        <StatCard label="Избранное" value={favoritesValue} hint="Сохранённые предложения" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Быстрые действия</CardTitle>
            <CardDescription>Всё нужное для поездки и отдыха.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <ActionLink href="/client/orders" label="Все заказы" />
            <ActionLink href="/client/bookings" label="Все брони" />
            <ActionLink href="/tours" label="Найти тур" variant="outline" />
            <ActionLink href="/stays" label="Найти жильё" variant="outline" />
            <ActionLink href="/food" label="Заказать еду" />
            <ActionLink href="/shop" label="Открыть магазин" />
            <ActionLink href="/client/favorites" label="Избранное" variant="outline" />
            <ActionLink href="/client/support" label="Поддержка" variant="outline" />
          </CardContent>
        </Card>

        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Один аккаунт на весь отдых</CardTitle>
            <CardDescription>
              Пользователь может планировать поездку, бронировать, заказывать и возвращаться к истории операций из одного кабинета.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <ActionLink href="/client/offers" label="Персональные предложения" />
            <ActionLink href="/client/profile" label="Профиль" variant="outline" />
          </CardFooter>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Последние заказы</CardTitle>
                <CardDescription>Food и Shop операции текущего аккаунта.</CardDescription>
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
                  <OrderStatusBadge status={normalizeOrderStatus(order.status)} />
                </div>
                <p className="mt-3 text-sm text-muted">
                  {order.total} KGS · {new Date(order.createdAt).toLocaleDateString("ru-RU")}
                </p>
              </a>
            ))}
            {orders.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-background p-5 text-sm text-muted">
                {ordersRead.ok ? "Заказов пока нет." : "Заказы сейчас временно недоступны."}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Последние бронирования</CardTitle>
                <CardDescription>Туры и жильё в единой истории.</CardDescription>
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
                  {booking.startDate}{booking.endDate ? ` — ${booking.endDate}` : ""} · {booking.total} {booking.currency}
                </p>
              </a>
            ))}
            {bookings.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-background p-5 text-sm text-muted">
                Бронирований пока нет.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </ClientLayout>
  );
}

function normalizeOrderStatus(status: string): ExtendedOrderStatus {
  switch (status) {
    case "new":
    case "accepted":
    case "preparing":
    case "assembling":
    case "ready":
    case "delivering":
    case "completed":
    case "rejected":
    case "cancelled":
    case "age_check":
    case "age_check_failed":
      return status;
    case "new_order": return "new";
    case "accepted_by_partner": return "accepted";
    case "ready_for_pickup": return "ready";
    case "courier_to_client":
    case "picked_up": return "delivering";
    case "delivered": return "completed";
    default: return "new";
  }
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

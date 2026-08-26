import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerWarningCard } from "@/components/partner/PartnerWarningCard";
import { BookingStatusBadge } from "@/components/status/BookingStatusBadge";
import { OrderStatusBadge } from "@/components/status/OrderStatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getPartnerBookingsReadResult } from "@/lib/data/partner-bookings-read";
import { getPartnerOrdersReadResult } from "@/lib/data/partner-orders-read";
import { getPartnerCabinetSummaryReadResult } from "@/lib/data/partners";

export default async function PartnerDashboardPage() {
  const [bookingResult, orderResult, partnerResult] = await Promise.all([
    getPartnerBookingsReadResult(),
    getPartnerOrdersReadResult(),
    getPartnerCabinetSummaryReadResult()
  ]);
  const orders = orderResult.orders;
  const bookings = bookingResult.ok ? bookingResult.data : [];
  const partner = partnerResult.ok ? partnerResult.data : undefined;
  const partnerOrders = orders.slice(0, 3);
  const partnerBookings = bookings.slice(0, 3);
  const newOrders = orders.filter((order) => ["new", "accepted", "preparing", "assembling"].includes(order.status)).length;
  const activeBookings = bookings.filter((booking) => ["pending", "confirmed", "checked_in"].includes(booking.status)).length;
  const waitingDeliveries = orders.filter((order) => ["preparing", "assembling", "ready", "delivering"].includes(order.status)).length;
  const operationsTotal = orders.reduce((sum, order) => sum + order.total, 0) + bookings.reduce((sum, booking) => sum + booking.total, 0);

  return (
    <PartnerLayout>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">KÖL Partner</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Кабинет партнёра</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Заказы, бронирования, каталог, доступность и операционные действия бизнеса — в одном защищённом контуре.
          </p>
        </div>
      </Card>

      {!orderResult.ok && orderResult.code !== "empty_result" ? (
        <PartnerWarningCard description="Заказы сейчас недоступны. Данные не подменяются общим или demo-каталогом." title="Заказы временно недоступны" tone="danger" />
      ) : null}
      {!bookingResult.ok ? (
        <PartnerWarningCard description="Данные бронирований сейчас недоступны. Остальные разделы кабинета продолжают работать независимо." title="Бронирования временно недоступны" tone="danger" />
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><CardTitle>Профиль бизнеса</CardTitle><CardDescription>Основная информация и текущий статус партнёра.</CardDescription></div>
            <Badge variant={partner?.businessStatus === "online" ? "success" : "warning"}>{partner?.businessStatus === "online" ? "Работает" : partner?.businessStatus ?? "Недоступно"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Бизнес" value={partner?.title ?? "Недоступно"} />
          <Info label="Тип" value={partner?.type ?? "Недоступно"} />
          <Info label="Локация" value={partner?.location ?? "Недоступно"} />
          <Info label="Рейтинг" value={`${partner?.rating ?? "—"}`} />
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Новые заказы" value={orderResult.ok || orderResult.code === "empty_result" ? newOrders : "—"} hint="Food + Shop" />
        <StatCard label="Активные брони" value={bookingResult.ok ? activeBookings : "—"} hint="Stay + Tours" />
        <StatCard label="Доставки в работе" value={orderResult.ok || orderResult.code === "empty_result" ? waitingDeliveries : "—"} hint="По статусу заказа" />
        <StatCard label="Сумма операций" value={orderResult.ok && bookingResult.ok ? `${operationsTotal} KGS` : "—"} hint="Подтверждённые записи" />
        <StatCard label="Рейтинг" value={partner?.rating ?? "—"} hint={partner?.title ?? "KÖL Partner"} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Быстрые действия</CardTitle><CardDescription>Основные рабочие разделы партнёра.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <ActionLink href="/partner/orders" label="Открыть заказы" />
            <ActionLink href="/partner/bookings" label="Управлять бронями" />
            <ActionLink href="/partner/catalog" label="Каталог" variant="outline" />
            <ActionLink href="/partner/availability" label="Доступность" variant="outline" />
            <ActionLink href="/partner/delivery" label="Доставка" variant="outline" />
            <ActionLink href="/partner/stop" label="Стоп-кнопка" variant="outline" />
          </CardContent>
        </Card>
        <Card className="border-primary/30">
          <CardHeader><CardTitle>Операционный статус</CardTitle><CardDescription>Быстрый контроль основных каналов продаж.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <Info label="Бизнес" value={partner ? (partner.businessStatus === "online" ? "Активен" : "Приостановлен") : "Недоступно"} />
            <Info label="Заказы" value={orderResult.ok || orderResult.code === "empty_result" ? (newOrders > 0 ? "Есть в работе" : "Без очереди") : "Недоступно"} />
            <Info label="Бронирования" value={bookingResult.ok ? (activeBookings > 0 ? "Есть активные" : "Без очереди") : "Недоступно"} />
          </CardContent>
        </Card>
      </section>

      <PartnerWarningCard description="Стоп-кнопка блокирует новые заявки в выбранном контуре и не должна менять финансовые статусы уже созданных операций." title="Контроль доступности" tone="warning" />

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Последние заказы</CardTitle><CardDescription>Последние операции Food и Shop текущего бизнеса.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {partnerOrders.map((order) => (
              <div className="rounded-lg border border-border bg-background p-4" key={order.id}>
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-foreground">{order.type === "food" ? "Заказ еды" : "Заказ магазина"}</p><p className="text-sm text-muted">{order.id}</p></div><OrderStatusBadge status={order.status} /></div>
                <p className="mt-3 text-sm text-muted">{order.total} {order.currency} · {new Date(order.createdAt).toLocaleDateString("ru-RU")}</p>
              </div>
            ))}
            {partnerOrders.length === 0 ? <EmptyRow text={orderResult.ok || orderResult.code === "empty_result" ? "Заказов пока нет." : "Заказы недоступны."} /> : null}
          </CardContent>
          <CardFooter><ActionLink href="/partner/orders" label="Открыть заказы" /></CardFooter>
        </Card>

        <Card>
          <CardHeader><CardTitle>Последние бронирования</CardTitle><CardDescription>Stay и Tours для текущего бизнеса.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {partnerBookings.map((booking) => (
              <div className="rounded-lg border border-border bg-background p-4" key={booking.id}>
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-foreground">{booking.title}</p><p className="text-sm text-muted">{booking.type === "tour" ? "Тур" : "Жильё"}</p></div><BookingStatusBadge status={booking.status} /></div>
                <p className="mt-3 text-sm text-muted">{booking.startDate}{booking.endDate ? ` — ${booking.endDate}` : ""} · {booking.total} {booking.currency}</p>
              </div>
            ))}
            {partnerBookings.length === 0 ? <EmptyRow text={bookingResult.ok ? "Бронирований пока нет." : "Брони недоступны."} /> : null}
          </CardContent>
          <CardFooter><ActionLink href="/partner/bookings" label="Открыть брони" /></CardFooter>
        </Card>
      </section>
    </PartnerLayout>
  );
}

function StatCard({ hint, label, value }: { hint: string; label: string; value: string | number }) { return <Card><CardContent className="space-y-3 p-5"><p className="text-sm font-medium text-muted">{label}</p><p className="text-3xl font-semibold text-primary">{value}</p><Badge variant="muted">{hint}</Badge></CardContent></Card>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-md border border-border bg-background p-3"><p className="text-xs text-muted">{label}</p><p className="font-semibold text-foreground">{value}</p></div>; }
function EmptyRow({ text }: { text: string }) { return <div className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted">{text}</div>; }
function ActionLink({ href, label, variant = "primary" }: { href: string; label: string; variant?: "primary" | "outline" }) { return <a className={variant === "primary" ? "inline-flex min-h-11 items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90" : "inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary"} href={href}>{label}</a>; }

import type { ReactNode } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getAdminBookingsReadResult } from "@/lib/data/admin-bookings-read";
import { getAdminDeliveryReadResult } from "@/lib/data/admin-delivery-read";
import { getAdminPartnersReadResult } from "@/lib/data/admin-partners-read";

const quickActions = [
  { label: "Заказы", href: "/admin/orders" },
  { label: "Бронирования", href: "/admin/bookings" },
  { label: "Доставки", href: "/admin/delivery" },
  { label: "Партнёры и каталог", href: "/admin/catalog" },
  { label: "Модерация", href: "/admin/moderation" },
  { label: "Финансы", href: "/admin/finance" },
  { label: "AI-диспетчер", href: "/admin/ai-dispatcher" }
];

export default async function AdminDashboardPage() {
  const [ordersRead, bookingsRead, partnersRead] = await Promise.all([
    getAdminDeliveryReadResult(),
    getAdminBookingsReadResult(),
    getAdminPartnersReadResult()
  ]);
  const orders = ordersRead.orders;
  const bookings = bookingsRead.bookings;
  const partners = partnersRead.partners;
  const activeOrders = orders.filter((order) => !["completed", "cancelled", "rejected"].includes(order.status)).length;
  const activeBookings = bookings.filter((booking) => !["completed", "cancelled", "rejected", "no_show"].includes(booking.status)).length;
  const orderAttention = orders.filter((order) => ["cancelled", "rejected"].includes(order.status) || order.paymentStatus === "failed").length;
  const bookingAttention = bookings.filter((booking) => ["pending", "cancelled", "rejected", "no_show"].includes(booking.status)).length;
  const readFailures = [ordersRead, bookingsRead, partnersRead].filter((result) => !result.ok && result.code !== "empty_result").length;
  const attention = orderAttention + bookingAttention + readFailures;

  return (
    <AdminLayout status={attention > 0 ? "attention" : "stable"}>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">KÖL Admin</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Единый операционный центр</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Заказы, бронирования и партнёры читаются через административный RLS-контур. Ошибка чтения не подменяется demo-данными.
          </p>
        </div>
      </Card>

      {readFailures > 0 ? (
        <Card className="border-danger/40 bg-danger/10"><CardContent className="p-4 text-sm font-medium">Часть операционных данных сейчас недоступна: {readFailures}. Метрики не дополняются mock-значениями.</CardContent></Card>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Активные заказы" value={ordersRead.ok || ordersRead.code === "empty_result" ? activeOrders : "—"} tone="info" />
        <StatCard label="Активные брони" value={bookingsRead.ok || bookingsRead.code === "empty_result" ? activeBookings : "—"} tone="success" />
        <StatCard label="Партнёры" value={partnersRead.ok || partnersRead.code === "empty_result" ? partners.length : "—"} tone="info" />
        <StatCard label="Проблемы заказов" value={ordersRead.ok || ordersRead.code === "empty_result" ? orderAttention : "—"} tone={orderAttention > 0 ? "danger" : "success"} />
        <StatCard label="Брони требуют внимания" value={bookingsRead.ok || bookingsRead.code === "empty_result" ? bookingAttention : "—"} tone={bookingAttention > 0 ? "warning" : "success"} />
      </section>

      <Card>
        <CardHeader><CardTitle>Быстрые действия</CardTitle><CardDescription>Переход к ключевым рабочим разделам.</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {quickActions.map((action, index) => <ActionLink href={action.href} key={action.href} variant={index < 2 ? "primary" : "outline"}>{action.label}</ActionLink>)}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Последние заказы</CardTitle><CardDescription>Оперативная лента Food и Shop.</CardDescription></CardHeader>
            <CardContent className="grid gap-3">
              {orders.slice(0, 4).map((order) => (
                <div className="rounded-lg border border-border bg-background p-4" key={order.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="font-semibold">{order.type === "food" ? "Заказ еды" : "Заказ магазина"}</p><p className="text-sm text-muted">{order.partnerTitle ?? order.businessId}</p></div>
                    <div className="flex flex-wrap gap-2"><Badge variant={order.status === "completed" ? "success" : ["cancelled", "rejected"].includes(order.status) ? "danger" : "info"}>{order.status}</Badge><Badge variant="muted">{order.total} KGS</Badge></div>
                  </div>
                </div>
              ))}
              {!orders.length ? <EmptyRow text={ordersRead.ok || ordersRead.code === "empty_result" ? "Заказов пока нет." : "Заказы недоступны."} /> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Последние бронирования</CardTitle><CardDescription>Stay и Tours в единой ленте.</CardDescription></CardHeader>
            <CardContent className="grid gap-3">
              {bookings.slice(0, 4).map((booking) => (
                <div className="rounded-lg border border-border bg-background p-4" key={booking.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="font-semibold">{booking.title}</p><p className="text-sm text-muted">{booking.startDate}{booking.endDate ? ` — ${booking.endDate}` : ""}</p></div>
                    <div className="flex flex-wrap gap-2"><Badge variant={booking.status === "confirmed" ? "success" : booking.status === "pending" ? "warning" : ["cancelled", "rejected", "no_show"].includes(booking.status) ? "danger" : "muted"}>{booking.status}</Badge><Badge variant="muted">{booking.total} {booking.currency}</Badge></div>
                  </div>
                </div>
              ))}
              {!bookings.length ? <EmptyRow text={bookingsRead.ok || bookingsRead.code === "empty_result" ? "Бронирований пока нет." : "Брони недоступны."} /> : null}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Партнёры</CardTitle><CardDescription>Состояние подключённых бизнесов.</CardDescription></CardHeader>
            <CardContent className="grid gap-3">
              {partners.slice(0, 5).map((partner) => (
                <div className="rounded-lg border border-border bg-background p-3" key={partner.id}>
                  <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{partner.title}</p><p className="text-xs text-muted">{partner.type} · {partner.location}</p></div><Badge variant={partner.businessStatus === "online" ? "success" : partner.businessStatus === "paused" ? "warning" : "muted"}>{partner.businessStatus}</Badge></div>
                </div>
              ))}
              {!partners.length ? <EmptyRow text={partnersRead.ok || partnersRead.code === "empty_result" ? "Партнёров пока нет." : "Партнёры недоступны."} /> : null}
            </CardContent>
          </Card>

          <Card className={attention > 0 ? "border-warning/40 bg-warning/10" : "border-border bg-surface"}>
            <CardHeader><CardTitle>Операционное внимание</CardTitle><CardDescription>Сводка только по фактическим статусам и сбоям чтения.</CardDescription></CardHeader>
            <CardContent className="grid gap-2"><Rule>Проблемы заказов: {orderAttention}</Rule><Rule>Брони требуют внимания: {bookingAttention}</Rule><Rule>Ошибки чтения: {readFailures}</Rule></CardContent>
          </Card>
        </aside>
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>AI-диспетчер</CardTitle><CardDescription>Рекомендации не имеют права менять финансовые или критические транзакционные статусы.</CardDescription></CardHeader><CardContent className="grid gap-3"><Rule>Оплата не меняется AI-модулем.</Rule><Rule>Критические действия требуют оператора.</Rule><Rule>Рекомендации строятся только на подтверждённых данных.</Rule></CardContent></Card>
        <Card><CardHeader><CardTitle>Контроль и безопасность</CardTitle><CardDescription>Операционные ограничения.</CardDescription></CardHeader><CardContent className="grid gap-3"><Rule>Статусы меняются только разрешёнными серверными операциями.</Rule><Rule>Платёжные события отделены от доставки.</Rule><Rule>Критические изменения должны проходить проверку прав.</Rule></CardContent></Card>
      </section>
    </AdminLayout>
  );
}

function StatCard({ label, tone, value }: { label: string; tone: BadgeVariant; value: number | string }) {
  return <Card><CardContent className="space-y-3 p-5"><p className="text-sm font-medium text-muted">{label}</p><p className="text-3xl font-semibold text-primary">{value}</p><Badge variant={tone}>KÖL Admin</Badge></CardContent></Card>;
}
function Rule({ children }: { children: ReactNode }) { return <div className="rounded-md border border-border bg-surface p-3 text-sm font-medium">{children}</div>; }
function EmptyRow({ text }: { text: string }) { return <div className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted">{text}</div>; }
function ActionLink({ children, href, variant = "primary" }: { children: ReactNode; href: string; variant?: "primary" | "outline" }) {
  return <a className={variant === "primary" ? "inline-flex min-h-11 items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90" : "inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary"} href={href}>{children}</a>;
}

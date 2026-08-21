import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { getAdminBookingsReadResult } from "@/lib/data/admin-bookings-read";
import { getAdminDeliveryReadResult } from "@/lib/data/admin-delivery-read";
import { getAdminPartnersReadResult } from "@/lib/data/admin-partners-read";
import { isMockDataMode } from "@/lib/data/data-source";

const previewShortcuts = [
  { href: "/admin", title: "Перейти в админку", description: "Полный операционный контроль платформы." },
  { href: "/partner", title: "Предпросмотр партнёра", description: "Показ интерфейса заказов, броней, каталога и доступности." },
  { href: "/courier", title: "Предпросмотр курьера", description: "Показ доставок, маршрутов и проблемных ситуаций." },
  { href: "/client", title: "Предпросмотр клиента", description: "Как платформу видит турист и покупатель." },
  { href: "/presentation", title: "Открыть презентацию", description: "Общий обзор экосистемы KÖL." },
  { href: "/", title: "Открыть витрину", description: "Главная, Stay, Tours, Food и Shop." }
];

const securedShortcuts = [
  { href: "/admin", title: "Перейти в админку", description: "Операционный контур, доступный роли собственника." },
  { href: "/presentation", title: "Открыть презентацию", description: "Общий обзор экосистемы KÖL без смены рабочей роли." },
  { href: "/", title: "Открыть витрину", description: "Проверить публичный клиентский сайт." }
];

export default async function OwnerPage() {
  const previewMode = isMockDataMode();
  const shortcuts = previewMode ? previewShortcuts : securedShortcuts;
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
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-sky-950 to-cyan-950 text-white">
      <Container className="space-y-8 py-8 sm:py-12">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-white/10 p-7 shadow-2xl backdrop-blur sm:p-10">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-cyan-300/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-amber-300/20 blur-3xl" />
          <div className="relative max-w-4xl">
            <div className="flex flex-wrap gap-2">
              <Badge className="border-white/20 bg-white text-slate-950">KÖL Owner</Badge>
              <Badge className="border-cyan-300/30 bg-cyan-300/15 text-cyan-100">Собственник</Badge>
              {previewMode ? <Badge className="border-amber-300/30 bg-amber-300/15 text-amber-100">Предпросмотр</Badge> : null}
            </div>
            <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-6xl">Кабинет собственника</h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-cyan-50/80 sm:text-lg">
              Продажи, бронирования и партнёры читаются из того же административного RLS-контура, который защищает операционную панель.
            </p>
          </div>
        </section>

        {!previewMode ? (
          <section className="rounded-2xl border border-cyan-200/20 bg-cyan-100/10 p-5 text-sm leading-6 text-cyan-50/85 backdrop-blur">
            Рабочие роли не переключаются через кабинет собственника. Partner, Courier и Client входят только под соответствующей учётной записью — без имперсонации и обхода RLS.
          </section>
        ) : null}

        {readFailures > 0 ? (
          <section className="rounded-2xl border border-red-300/30 bg-red-300/10 p-5 text-sm leading-6 text-red-50 backdrop-blur">
            Часть операционных данных недоступна: {readFailures}. KÖL не подменяет их demo-значениями и не показывает ложные нули.
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Активные заказы" value={ordersRead.ok || ordersRead.code === "empty_result" ? activeOrders : "—"} />
          <Metric label="Активные брони" value={bookingsRead.ok || bookingsRead.code === "empty_result" ? activeBookings : "—"} />
          <Metric label="Партнёры" value={partnersRead.ok || partnersRead.code === "empty_result" ? partners.length : "—"} />
          <Metric label="Заказы требуют проверки" value={ordersRead.ok || ordersRead.code === "empty_result" ? orderAttention : "—"} danger={orderAttention > 0} />
          <Metric label="Брони требуют внимания" value={bookingsRead.ok || bookingsRead.code === "empty_result" ? bookingAttention : "—"} danger={bookingAttention > 0} />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shortcuts.map((item) => (
            <Link className="group" href={item.href} key={item.href}>
              <Card className="h-full border-white/10 bg-white/95 text-slate-950 transition duration-200 group-hover:-translate-y-1 group-hover:border-cyan-300 group-hover:shadow-2xl">
                <CardHeader><CardTitle>{item.title}</CardTitle><CardDescription className="leading-6">{item.description}</CardDescription></CardHeader>
                <CardContent><span className="font-semibold text-primary">Открыть →</span></CardContent>
              </Card>
            </Link>
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          <OwnerList title="Последние заказы" unavailable={!ordersRead.ok && ordersRead.code !== "empty_result"} items={orders.slice(0, 4).map((order) => `${order.type === "food" ? "Еда" : "Магазин"} · ${order.total} KGS · ${order.status}`)} />
          <OwnerList title="Последние бронирования" unavailable={!bookingsRead.ok && bookingsRead.code !== "empty_result"} items={bookings.slice(0, 4).map((booking) => `${booking.title} · ${booking.total} ${booking.currency} · ${booking.status}`)} />
          <OwnerList title="Партнёры" unavailable={!partnersRead.ok && partnersRead.code !== "empty_result"} items={partners.slice(0, 5).map((partner) => `${partner.title} · ${partner.location} · ${partner.businessStatus}`)} />
        </section>

        <section className="rounded-[2rem] border border-white/15 bg-white/10 p-6 backdrop-blur sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">Операционная сводка</p>
              <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">Одна экосистема — разделённые рабочие роли</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-cyan-50/75">Stay, Tours, Food и Shop работают в одном клиентском контуре. В preview можно показать роли; в Supabase-режиме каждая роль остаётся в своём RLS-контуре.</p>
            </div>
            <Link className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg transition hover:bg-amber-200" href="/admin">Перейти в админку</Link>
          </div>
        </section>
      </Container>
    </main>
  );
}

function Metric({ danger = false, label, value }: { danger?: boolean; label: string; value: number | string }) {
  return <Card className="border-white/10 bg-white/95 text-slate-950"><CardContent className="p-5"><p className="text-sm font-medium text-muted">{label}</p><p className={`mt-2 text-4xl font-semibold ${danger ? "text-red-600" : "text-primary"}`}>{value}</p></CardContent></Card>;
}
function OwnerList({ items, title, unavailable = false }: { items: string[]; title: string; unavailable?: boolean }) {
  return <Card className="border-white/10 bg-white/95 text-slate-950"><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="space-y-2">{items.length ? items.map((item) => <div className="rounded-xl border border-border bg-background p-3 text-sm font-medium" key={item}>{item}</div>) : <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">{unavailable ? "Данные временно недоступны." : "Пока нет данных."}</div>}</CardContent></Card>;
}

import Link from "next/link";
import { ClientLayout } from "@/components/layout/ClientLayout";
import { BookingStatusBadge } from "@/components/status/BookingStatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getBookingById, getClientBookings } from "@/lib/data/bookings";
import type { Booking, BookingStatus } from "@/types";

type BookingDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const baseTourStatuses: BookingStatus[] = ["pending", "confirmed", "completed", "cancelled", "rejected", "no_show"];
const baseStayStatuses: BookingStatus[] = ["pending", "confirmed", "checked_in", "completed", "cancelled", "rejected", "no_show"];

export function generateStaticParams() {
  return getClientBookings().map((booking) => ({ id: booking.id }));
}

export default async function ClientBookingDetailPage({ params }: BookingDetailPageProps) {
  const { id } = await params;
  const booking = getBookingById(id);

  if (!booking) {
    return (
      <ClientLayout>
        <NotFoundState />
      </ClientLayout>
    );
  }

  const statuses = booking.type === "stay" ? baseStayStatuses : baseTourStatuses;

  return (
    <ClientLayout>
      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium">Demo cabinet. Реальная авторизация и личные данные будут подключены позже.</CardContent>
      </Card>

      <Breadcrumb current="Бронь" parentHref="/client/bookings" parentLabel="Мои брони" />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Badge className="w-fit" variant="info">Booking detail</Badge>
                  <CardTitle className="mt-3 text-2xl">Детали брони</CardTitle>
                  <CardDescription>{booking.id}</CardDescription>
                </div>
                <BookingStatusBadge status={booking.status} />
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Info label="Тип брони" value={booking.type === "tour" ? "Тур" : "Жильё"} />
              <Info label="Объект бронирования" value={booking.title} />
              <Info label="Партнёр" value={booking.businessId} />
              <Info label="Даты" value={`${booking.startDate}${booking.endDate ? ` - ${booking.endDate}` : ""}`} />
              <Info label="Гости" value={`${booking.guests}`} />
              <Info label="Способ оплаты" value={booking.paymentStatus} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Правила отмены demo</CardTitle>
              <CardDescription>Финальные правила будут определены партнёром и compliance flow.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <NextStep title="Бесплатная отмена зависит от правил партнёра" />
              <NextStep title="Поздняя отмена может требовать поддержки" />
              <NextStep title="No-show фиксируется отдельным статусом" />
            </CardContent>
          </Card>

          <StatusHistory currentStatus={booking.status} statuses={statuses} />

          <Card>
            <CardHeader>
              <CardTitle>Что дальше</CardTitle>
              <CardDescription>Demo-сценарий обработки брони.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <NextStep title="Бронь ожидает подтверждения партнёра" />
              <NextStep title="Клиент получит уведомление" />
              <NextStep title="Изменения дат через поддержку" />
            </CardContent>
          </Card>
        </div>

        <SummaryCard booking={booking} />
      </section>
    </ClientLayout>
  );
}

function Breadcrumb({ current, parentHref, parentLabel }: { current: string; parentHref: string; parentLabel: string }) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm font-medium text-muted">
        <Link className="text-primary hover:opacity-80" href="/client">Кабинет</Link>
        <span>/</span>
        <a className="text-primary hover:opacity-80" href={parentHref}>{parentLabel}</a>
        <span>/</span>
        <span className="text-foreground">{current}</span>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function StatusHistory({ currentStatus, statuses }: { currentStatus: BookingStatus; statuses: BookingStatus[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>История статусов</CardTitle>
        <CardDescription>Demo timeline брони.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        {statuses.map((status) => (
          <div className="rounded-lg border border-border bg-background p-3" key={status}>
            <BookingStatusBadge status={status} />
            <p className="mt-2 text-xs text-muted">{status === currentStatus ? "Текущий статус" : "Возможный этап"}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function NextStep({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4 text-sm font-semibold">
      {title}
    </div>
  );
}

function SummaryCard({ booking }: { booking: Booking }) {
  const discount = 0;
  const points = 0;
  const prepayment = 0;

  return (
    <Card className="h-fit xl:sticky xl:top-6">
      <CardHeader>
        <CardTitle>Итог брони</CardTitle>
        <CardDescription>Summary справа на desktop и снизу на mobile.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <SummaryRow label="Booking type" value={booking.type === "tour" ? "Тур" : "Жильё"} />
        <SummaryRow label="Subtotal" value={`${booking.total} ${booking.currency}`} />
        <SummaryRow label="Discount" value={`${discount} ${booking.currency}`} />
        <SummaryRow label="Points" value={`${points} ${booking.currency}`} />
        <SummaryRow label="Prepayment" value={`${prepayment} ${booking.currency}`} />
        <div className="border-t border-border pt-3">
          <SummaryRow label="Total" strong value={`${booking.total} ${booking.currency}`} />
        </div>
      </CardContent>
      <CardFooter>
        <Link className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary" href="/client/bookings">
          Назад к броням
        </Link>
        <Link className="inline-flex min-h-11 items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90" href="/client/support">
          Изменить даты
        </Link>
        <Link className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary" href="/client/support">
          Написать в поддержку
        </Link>
      </CardFooter>
    </Card>
  );
}

function SummaryRow({ label, strong, value }: { label: string; strong?: boolean; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className={strong ? "text-lg font-semibold text-primary" : "font-semibold"}>{value}</span>
    </div>
  );
}

function NotFoundState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Бронь не найдена</CardTitle>
        <CardDescription>В demo data нет брони с таким ID.</CardDescription>
      </CardHeader>
      <CardFooter>
        <Link className="inline-flex min-h-11 items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90" href="/client/bookings">
          Вернуться к броням
        </Link>
      </CardFooter>
    </Card>
  );
}

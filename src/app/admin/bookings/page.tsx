import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getAdminBookingsReadResult } from "@/lib/data/admin-bookings-read";
import type { BookingStatus } from "@/types";

const statusVariant: Record<BookingStatus, BadgeVariant> = {
  pending: "warning",
  confirmed: "success",
  checked_in: "info",
  completed: "success",
  cancelled: "danger",
  rejected: "danger",
  no_show: "danger"
};

function bishkekDateKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bishkek",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export default async function AdminBookingsPage() {
  const readResult = await getAdminBookingsReadResult();
  const bookings = readResult.bookings;
  const todayKey = bishkekDateKey();
  const newBookings = bookings.filter((booking) => booking.status === "pending").length;
  const confirmed = bookings.filter((booking) => booking.status === "confirmed").length;
  const today = bookings.filter((booking) => booking.startDate === todayKey).length;
  const cancelled = bookings.filter((booking) => booking.status === "cancelled").length;
  const attention = bookings.filter((booking) => ["pending", "cancelled", "rejected", "no_show"].includes(booking.status)).length;
  const unavailable = !readResult.ok && readResult.code !== "empty_result";

  return (
    <AdminLayout status={attention > 0 || unavailable ? "attention" : "stable"}>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">KÖL Booking Control</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Бронирования</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Жильё и туры собраны в единой операционной ленте. Метрики строятся только по доступным данным платформы и не дополняются выдуманной историей.
          </p>
        </div>
      </Card>

      {unavailable ? (
        <Card className="border-danger/40 bg-danger/10"><CardContent className="p-4 text-sm font-medium">Бронирования сейчас недоступны. KÖL не подменяет их демонстрационными значениями.</CardContent></Card>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Новые" value={newBookings} tone="warning" />
        <StatCard label="Подтверждённые" value={confirmed} tone="success" />
        <StatCard label="Старт сегодня" value={today} tone="info" />
        <StatCard label="Отменённые" value={cancelled} tone="danger" />
        <StatCard label="Требуют внимания" value={attention} tone={attention > 0 ? "warning" : "success"} />
      </section>

      <section className="grid gap-4">
        {bookings.map((booking) => (
          <Card key={booking.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{booking.title}</CardTitle>
                  <CardDescription>{booking.type === "tour" ? "Тур" : "Жильё"} · {booking.id}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={statusVariant[booking.status]}>{booking.status}</Badge>
                  <Badge variant={booking.paymentStatus === "paid" ? "success" : booking.paymentStatus === "failed" ? "danger" : "muted"}>{booking.paymentStatus}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <Info label="ID клиента" value={booking.clientUserId} />
              <Info label="ID партнёра" value={booking.businessId} />
              <Info label="ID объекта" value={booking.targetId} />
              <Info label="Даты" value={`${booking.startDate}${booking.endDate ? ` - ${booking.endDate}` : ""}`} />
              <Info label="Гости" value={`${booking.guests}`} />
              <Info label="Итого" value={`${booking.total} ${booking.currency}`} />
            </CardContent>
          </Card>
        ))}
        {!unavailable && bookings.length === 0 ? <EmptyRow text="Бронирований пока нет." /> : null}
      </section>

      <Card className="border-primary/20 bg-lake-light">
        <CardHeader>
          <CardTitle>Контролируемые изменения</CardTitle>
          <CardDescription>Подтверждение, отмена, доступность и платёжный статус меняются только через разрешённые серверные процессы. Экран наблюдения не выполняет критические действия сам.</CardDescription>
        </CardHeader>
      </Card>
    </AdminLayout>
  );
}

function StatCard({ label, tone, value }: { label: string; tone: BadgeVariant; value: string | number }) {
  return <Card><CardContent className="space-y-3 p-5"><p className="text-sm font-medium text-muted">{label}</p><p className="text-3xl font-semibold text-primary">{value}</p><Badge variant={tone}>Брони</Badge></CardContent></Card>;
}
function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-border bg-background p-3"><p className="text-xs font-medium text-muted">{label}</p><p className="mt-1 break-all font-semibold text-foreground">{value}</p></div>;
}
function EmptyRow({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted">{text}</div>;
}

import { EmptyState } from "@/components/catalog/EmptyState";
import { ClientLayout } from "@/components/layout/ClientLayout";
import { BookingStatusBadge } from "@/components/status/BookingStatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getClientBookingsReadResult } from "@/lib/data/client-bookings-read";

export default async function ClientBookingsPage() {
  const readResult = await getClientBookingsReadResult();
  const bookings = readResult.bookings;

  return (
    <ClientLayout>
      <Card>
        <CardHeader>
          <Badge className="w-fit" variant="info">Bookings</Badge>
          <CardTitle className="text-2xl">Мои брони</CardTitle>
          <CardDescription>Брони туров и жилья текущего аккаунта KÖL.</CardDescription>
        </CardHeader>
      </Card>

      {bookings.length === 0 ? (
        <EmptyState
          actionLabel="Смотреть туры"
          description={readResult.code === "empty_result" || readResult.ok ? "Выберите тур или жильё и оформите бронирование." : "Брони сейчас временно недоступны. Повторите позже."}
          href="/tours"
          title={readResult.code === "empty_result" || readResult.ok ? "Броней пока нет" : "Не удалось загрузить брони"}
        />
      ) : (
        <div className="grid gap-4">
          {bookings.map((booking) => (
            <Card key={booking.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{booking.title}</CardTitle>
                    <CardDescription>
                      {booking.type === "tour" ? "Тур" : "Жильё"} · {booking.id}
                    </CardDescription>
                  </div>
                  <BookingStatusBadge status={booking.status} />
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-4">
                <Info label="Даты" value={`${booking.startDate}${booking.endDate ? ` - ${booking.endDate}` : ""}`} />
                <Info label="Гости" value={`${booking.guests}`} />
                <Info label="Сумма" value={`${booking.total} ${booking.currency}`} />
                <Info label="Оплата" value={booking.paymentStatus} />
              </CardContent>
              <CardFooter>
                <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary" href={`/client/bookings/${booking.id}`}>
                  Детали
                </a>
                <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary" href="/client/support">
                  Изменить даты через поддержку
                </a>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </ClientLayout>
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

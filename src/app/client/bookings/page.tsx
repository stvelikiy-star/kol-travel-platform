import { EmptyState } from "@/components/catalog/EmptyState";
import { ClientLayout } from "@/components/layout/ClientLayout";
import { BookingStatusBadge } from "@/components/status/BookingStatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getClientBookings } from "@/lib/data/bookings";

export default function ClientBookingsPage() {
  const bookings = getClientBookings();

  return (
    <ClientLayout>
      <Card>
        <CardHeader>
          <Badge className="w-fit" variant="info">Bookings</Badge>
          <CardTitle className="text-2xl">Мои брони</CardTitle>
          <CardDescription>Demo-список броней туров и жилья. Проверка доступности будет подключена позже.</CardDescription>
        </CardHeader>
      </Card>

      {bookings.length === 0 ? (
        <EmptyState
          actionLabel="Смотреть туры"
          description="Выберите тур или жильё в каталоге и оформите demo-бронь."
          href="/tours"
          title="Броней пока нет"
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
                <a
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary"
                  href={`/client/bookings/${booking.id}`}
                >
                  Детали
                </a>
                <Button>Изменить даты</Button>
                <a
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary"
                  href="/client/support"
                >
                  Поддержка
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

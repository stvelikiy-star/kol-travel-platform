import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { mockBookings } from "@/data/mockBookings";
import { mockPartners } from "@/data/mockPartners";

const booking = mockBookings[1];
const partner = mockPartners.find((item) => item.id === booking.businessId);
const nextSteps = [
  "бронь будет отправлена партнёру",
  "партнёр подтвердит или отклонит бронь",
  "клиент получит уведомление",
  "при подтверждении бронь появится в кабинете клиента"
];

export default function BookingSuccessPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="space-y-8 py-10">
        <section className="rounded-lg border border-border/80 bg-gradient-to-br from-lake-light via-surface to-sand-light p-6 shadow-soft">
          <SectionTitle
            description="Реальная проверка доступности, подтверждение партнёром и уведомления будут подключены на следующих этапах."
            eyebrow="Success demo"
            title="Бронь создана в demo mode"
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Demo booking</CardTitle>
              <CardDescription>Данные взяты из mockBookings.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Info label="Booking ID" value={booking.id} />
              <Info label="Тип брони" value={booking.type === "tour" ? "тур" : "жильё"} />
              <Info label="Статус" value={booking.status} />
              <Info label="Объект" value={booking.title} />
              <Info
                label="Даты"
                value={booking.endDate ? `${booking.startDate} — ${booking.endDate}` : booking.startDate}
              />
              <Info label="Гости" value={String(booking.guests)} />
              <Info label="Сумма" value={`${booking.total} ${booking.currency}`} />
              <Info label="Партнёр" value={partner?.title ?? "KÖL Partner"} />
              <Info label="Способ оплаты" value={booking.paymentStatus} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What happens next</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {nextSteps.map((step, index) => (
                <div className="flex gap-3 rounded-md border border-border/80 bg-background p-3 text-sm" key={step}>
                  <Badge>{index + 1}</Badge>
                  <p className="font-medium">{step}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="border-warning/40 bg-warning/10">
          <CardContent className="p-5 text-sm font-medium leading-6 text-foreground">
            Это demo page. Реальная booking CRM, RoomAvailability/TourSchedule и уведомления будут
            подключены позже.
          </CardContent>
        </Card>

        <section className="flex flex-wrap gap-3">
          <NavButton href="/" label="На главную" />
          <NavButton href="/tours" label="Смотреть туры" />
          <NavButton href="/stays" label="Смотреть жильё" />
          <NavButton href="/booking/checkout" label="Оформить ещё бронь" />
        </section>
      </Container>
      <PublicFooter />
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-background p-3 text-sm">
      <p className="text-muted">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function NavButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:bg-lake-light hover:text-primary"
      href={href}
    >
      {label}
    </a>
  );
}

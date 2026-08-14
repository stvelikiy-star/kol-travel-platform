import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerIssueEscalationPanel } from "@/app/partner/_components/PartnerIssueEscalationPanel";
import { PartnerBookingActions } from "@/components/partner/PartnerBookingActions";
import { PartnerWarningCard } from "@/components/partner/PartnerWarningCard";
import { BookingStatusBadge } from "@/components/status/BookingStatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getPartnerBookingsReadResult } from "@/lib/data/partner-bookings-read";

const filters = ["Все", "Новые", "Подтверждённые", "Завершённые", "Отменённые"];

export default async function PartnerBookingsPage() {
  const result = await getPartnerBookingsReadResult();
  const bookings = result.ok ? result.data : [];
  const newBookings = bookings.filter((booking) => booking.status === "pending").length;
  const confirmedBookings = bookings.filter((booking) => booking.status === "confirmed").length;
  const todayBookings = bookings.filter((booking) => booking.startDate === "2026-07-01").length;
  const attentionBookings = bookings.filter((booking) => ["pending", "cancelled", "rejected", "no_show"].includes(booking.status)).length;

  return (
    <PartnerLayout>
      <PartnerIssueEscalationPanel context="bookings" />

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Booking CRM</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Брони партнёра</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            CRM броней жилья и туров. Данные кабинета доступны только в рамках бизнеса партнёра.
          </p>
        </div>
      </Card>

      <PartnerWarningCard
        description={result.ok
          ? result.source === "mock"
            ? "Intentional mock mode: показаны демонстрационные брони."
            : "Показаны read-only брони авторизованного бизнеса."
          : "Брони недоступны: авторизация, ownership или защищённое чтение не подтверждены."}
        title={result.ok ? (result.source === "mock" ? "Demo режим" : "Защищённое чтение") : "Данные недоступны"}
        tone={result.ok ? "info" : "danger"}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Новые брони" value={newBookings} />
        <StatCard label="Подтверждённые" value={confirmedBookings} />
        <StatCard label="Сегодня" value={todayBookings} />
        <StatCard label="Требуют внимания" value={attentionBookings} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Фильтры</CardTitle>
          <CardDescription>UI-only tabs для будущей CRM фильтрации броней.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {filters.map((filter, index) => (
            <Button key={filter} variant={index === 0 ? "primary" : "outline"}>
              {filter}
            </Button>
          ))}
        </CardContent>
      </Card>

      <PartnerWarningCard
        description="Бронь подтверждает партнёр. Доступность номеров/туров будет контролироваться через отдельный модуль."
        items={[
          "Партнёр подтверждает или отклоняет бронь",
          "Календарь доступности управляет будущими датами",
          "Подтверждённые брони нельзя отменять без правил админа",
          "Overbooking закрытых дат запрещён"
        ]}
        title="Важное про доступность"
        tone="warning"
      />

      <section className="grid gap-4">
        {bookings.map((booking) => (
          <Card key={booking.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{booking.title}</CardTitle>
                  <CardDescription>
                    {booking.id} · Client {booking.clientUserId}
                  </CardDescription>
                </div>
                <BookingStatusBadge status={booking.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <Info label="Тип" value={booking.type === "tour" ? "tour" : "stay"} />
                <Info label="Даты" value={`${booking.startDate}${booking.endDate ? ` - ${booking.endDate}` : ""}`} />
                <Info label="Гости" value={`${booking.guests}`} />
                <Info label="Сумма" value={`${booking.total} ${booking.currency}`} />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Info label="Оплата" value={booking.paymentStatus} />
                <Info label="Бизнес" value={booking.businessId} />
                <Info label="Объект" value={booking.title} />
              </div>
            </CardContent>
            <CardContent className="pt-0">
              <PartnerBookingActions compact detailHref={`/partner/bookings/${booking.id}`} />
            </CardContent>
          </Card>
        ))}
      </section>
    </PartnerLayout>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="text-3xl font-semibold text-primary">{value}</p>
        <Badge variant="muted">bookings</Badge>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-semibold text-foreground">{value}</p>
    </div>
  );
}

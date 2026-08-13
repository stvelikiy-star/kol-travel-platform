import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getAdminBookings } from "@/lib/data/admin";
import type { BookingStatus, PaymentStatus } from "@/types";

type RiskLevel = "low" | "medium" | "high" | "critical";

const filters = ["Все", "Новые", "Подтверждённые", "Заселение сегодня", "Завершённые", "Отменённые", "Проблемные"];

const statusVariant: Record<BookingStatus, BadgeVariant> = {
  pending: "warning",
  confirmed: "success",
  checked_in: "info",
  completed: "success",
  cancelled: "danger",
  rejected: "danger",
  no_show: "danger"
};

const riskVariant: Record<RiskLevel, BadgeVariant> = {
  low: "success",
  medium: "warning",
  high: "danger",
  critical: "danger"
};

export default function AdminBookingsPage() {
  const bookings = getAdminBookings();
  const newBookings = bookings.filter((booking) => booking.status === "pending").length;
  const confirmed = bookings.filter((booking) => booking.status === "confirmed").length;
  const today = bookings.filter((booking) => booking.startDate === "2026-07-01").length;
  const cancelled = bookings.filter((booking) => booking.status === "cancelled").length;
  const attention = bookings.filter((booking) => ["pending", "cancelled", "rejected", "no_show"].includes(booking.status)).length;

  return (
    <AdminLayout status="attention">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Booking control</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Брони</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Demo control page для жилья, туров, подтверждений партнёра, доступности и спорных ситуаций.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium text-foreground">
          Demo admin panel. Реальная booking CRM, RoomAvailability и TourSchedule будут подключены позже.
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Новые" value={newBookings} tone="warning" />
        <StatCard label="Подтверждённые" value={confirmed} tone="success" />
        <StatCard label="Сегодня" value={today} tone="info" />
        <StatCard label="Отменённые" value={cancelled} tone="danger" />
        <StatCard label="Требуют внимания" value={attention} tone="warning" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Фильтры</CardTitle>
          <CardDescription>UI-only фильтры для будущего admin booking control.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {filters.map((filter, index) => (
            <Button key={filter} variant={index === 0 ? "primary" : "outline"}>
              {filter}
            </Button>
          ))}
        </CardContent>
      </Card>

      <section className="grid gap-4">
        {bookings.map((booking, index) => {
          const risk = getBookingRisk(booking.status, booking.paymentStatus, index);

          return (
            <Card key={booking.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{booking.id}</CardTitle>
                    <CardDescription>{booking.type} · client demo {booking.clientUserId.replace("client-", "")}</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={statusVariant[booking.status]}>{booking.status}</Badge>
                    <Badge variant={riskVariant[risk]}>{risk} risk</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <Info label="Partner demo" value={booking.businessId} />
                  <Info label="Object name" value={booking.title} />
                  <Info label="Dates" value={`${booking.startDate}${booking.endDate ? ` - ${booking.endDate}` : ""}`} />
                  <Info label="Guests" value={`${booking.guests}`} />
                  <Info label="Total" value={`${booking.total} ${booking.currency}`} />
                  <Info label="Payment method" value={booking.paymentStatus} />
                </div>
              </CardContent>
              <CardFooter>
                <Button>Открыть детали demo</Button>
                <Button variant="outline">Связаться с партнёром demo</Button>
                <Button variant="outline">Связаться с клиентом demo</Button>
                <Button variant="outline">Проверить доступность demo</Button>
                <Button variant="danger">Поднять проблему demo</Button>
              </CardFooter>
            </Card>
          );
        })}
      </section>

      <RulesCard
        items={[
          "Accepted bookings require rules before cancellation.",
          "Closed dates block new bookings only.",
          "Admin controls disputes demo."
        ]}
      />
    </AdminLayout>
  );
}

function getBookingRisk(status: BookingStatus, payment: PaymentStatus, index: number): RiskLevel {
  if (["cancelled", "rejected", "no_show"].includes(status)) return "high";
  if (status === "pending" && payment === "pending") return "medium";
  if (index % 3 === 0) return "medium";
  return "low";
}

function StatCard({ label, tone, value }: { label: string; tone: BadgeVariant; value: string | number }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="text-3xl font-semibold text-primary">{value}</p>
        <Badge variant={tone}>booking demo</Badge>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </div>
  );
}

function RulesCard({ items }: { items: string[] }) {
  return (
    <Card className="border-warning/40 bg-warning/10">
      <CardHeader>
        <CardTitle>Admin booking rules</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {items.map((item) => (
          <div className="rounded-md border border-warning/30 bg-surface p-3 text-sm font-medium text-foreground" key={item}>
            {item}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

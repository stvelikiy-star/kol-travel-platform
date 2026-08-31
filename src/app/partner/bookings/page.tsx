import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerIssueEscalationPanel } from "@/app/partner/_components/PartnerIssueEscalationPanel";
import { PartnerBookingActions } from "@/components/partner/PartnerBookingActions";
import { PartnerWarningCard } from "@/components/partner/PartnerWarningCard";
import { BookingStatusBadge } from "@/components/status/BookingStatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getPartnerBookingsReadResult } from "@/lib/data/partner-bookings-read";

type BookingSearchParams = {
  partnerAction?: string | string[];
  action?: string | string[];
  code?: string | string[];
};

const filters = ["Все", "Новые", "Подтверждённые", "Завершённые", "Отменённые"];

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PartnerBookingsPage({ searchParams }: { searchParams?: Promise<BookingSearchParams> }) {
  const resolvedSearchParams = await searchParams;
  const actionState = first(resolvedSearchParams?.partnerAction);
  const action = first(resolvedSearchParams?.action);
  const actionCode = first(resolvedSearchParams?.code);
  const result = await getPartnerBookingsReadResult();
  const bookings = result.ok ? result.data : [];
  const newBookings = bookings.filter((booking) => booking.status === "pending").length;
  const confirmedBookings = bookings.filter((booking) => booking.status === "confirmed").length;
  const today = new Date().toISOString().slice(0, 10);
  const todayBookings = bookings.filter((booking) => booking.startDate === today).length;
  const attentionBookings = bookings.filter((booking) => ["pending", "cancelled", "rejected", "no_show"].includes(booking.status)).length;

  return (
    <PartnerLayout>
      <PartnerIssueEscalationPanel context="bookings" />

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Booking CRM</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Брони партнёра</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            CRM броней жилья и туров. Данные и разрешённые действия ограничены бизнесом текущего партнёра.
          </p>
        </div>
      </Card>

      {actionState ? (
        <Card className={actionState === "success" ? "border-success/40 bg-success/10" : "border-danger/40 bg-danger/10"}>
          <CardContent className="p-4 text-sm font-medium leading-6 text-foreground" role="status">
            {actionState === "success"
              ? actionSuccessText(action)
              : `Действие отклонено безопасно${actionCode ? `: ${actionCode}` : "."}`}
          </CardContent>
        </Card>
      ) : null}

      <PartnerWarningCard
        description={result.ok
          ? result.source === "mock"
            ? "Intentional mock mode: показаны демонстрационные брони, реальные записи не изменяются."
            : "Брони читаются из защищённого источника; разрешённые lifecycle-действия выполняются через атомарный серверный контур."
          : "Брони недоступны: авторизация, ownership или защищённое чтение не подтверждены."}
        title={result.ok ? (result.source === "mock" ? "Demo режим" : "Защищённый Booking CRM") : "Данные недоступны"}
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
          <CardDescription>Фильтрация CRM остаётся отдельным UI-улучшением и не влияет на серверную модель статусов.</CardDescription>
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
        description="Партнёр управляет подтверждением и прибытием. Доступность номеров/туров остаётся отдельным модулем."
        items={[
          "Новая бронь: подтвердить или отклонить",
          "Подтверждённая бронь: отметить прибытие",
          "Запрос отмены не отменяет бронь и не запускает возврат",
          "Партнёр не может менять статус оплаты"
        ]}
        title="Операционные ограничения"
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
              <PartnerBookingActions
                bookingId={booking.id}
                compact
                detailHref={`/partner/bookings/${booking.id}`}
                status={booking.status}
              />
            </CardContent>
          </Card>
        ))}
      </section>
    </PartnerLayout>
  );
}

function actionSuccessText(action?: string) {
  const messages: Record<string, string> = {
    confirm: "Бронь подтверждена сервером и записана в историю.",
    reject: "Бронь отклонена сервером и записана в историю.",
    check_in: "Прибытие гостя подтверждено сервером.",
    report_issue: "Проблема по брони зафиксирована для проверки.",
    request_cancellation: "Запрос отмены зафиксирован. Бронь и статус оплаты не изменены."
  };
  return messages[action ?? ""] ?? "Действие подтверждено сервером.";
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

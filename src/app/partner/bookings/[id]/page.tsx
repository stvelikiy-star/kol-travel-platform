import type { ReactNode } from "react";
import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerIssueEscalationPanel } from "@/app/partner/_components/PartnerIssueEscalationPanel";
import { PartnerBookingActions } from "@/components/partner/PartnerBookingActions";
import { PartnerStatusTimeline, type PartnerTimelineStep } from "@/components/partner/PartnerStatusTimeline";
import { PartnerWarningCard } from "@/components/partner/PartnerWarningCard";
import { BookingStatusBadge } from "@/components/status/BookingStatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getPartnerBookingReadResult } from "@/lib/data/partner-bookings-read";
import type { PartnerBooking } from "@/lib/types/partner-bookings";
import type { BookingStatus } from "@/types";

type PartnerBookingDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    partnerAction?: string | string[];
    action?: string | string[];
    code?: string | string[];
  }>;
};

const tourTimeline: BookingStatus[] = ["pending", "confirmed", "completed", "cancelled", "rejected", "no_show"];
const stayTimeline: BookingStatus[] = ["pending", "confirmed", "checked_in", "completed", "cancelled", "rejected", "no_show"];

export function generateStaticParams() {
  return [];
}

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PartnerBookingDetailPage({ params, searchParams }: PartnerBookingDetailPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const actionState = first(resolvedSearchParams?.partnerAction);
  const action = first(resolvedSearchParams?.action);
  const actionCode = first(resolvedSearchParams?.code);
  const result = await getPartnerBookingReadResult(id);
  const booking = result.ok ? result.data[0] : undefined;

  if (!booking) {
    return (
      <PartnerLayout>
        <NotFoundState />
      </PartnerLayout>
    );
  }

  return (
    <PartnerLayout>
      <Breadcrumb current="Бронь" parentHref="/partner/bookings" parentLabel="Брони" />
      <PartnerIssueEscalationPanel context="booking-detail" />

      {actionState ? (
        <Card className={actionState === "success" ? "border-success/40 bg-success/10" : "border-danger/40 bg-danger/10"}>
          <CardContent className="p-4 text-sm font-medium leading-6 text-foreground" role="status">
            {actionState === "success"
              ? actionSuccessText(action)
              : `Действие отклонено безопасно${actionCode ? `: ${actionCode}` : "."}`}
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Badge variant="info">Partner booking detail</Badge>
                  <CardTitle className="mt-3 text-2xl">Детали брони</CardTitle>
                  <CardDescription>{booking.id}</CardDescription>
                </div>
                <BookingStatusBadge status={booking.status} />
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Info label="Client" value={booking.clientUserId} />
              <Info label="Booking type" value={booking.type === "tour" ? "tour" : "stay"} />
              <Info label="Object name" value={booking.title} />
              <Info label="Partner" value={booking.businessId} />
              <Info label="Dates" value={`${booking.startDate}${booking.endDate ? ` - ${booking.endDate}` : ""}`} />
              <Info label="Guests" value={`${booking.guests}`} />
              <Info label="Payment status" value={booking.paymentStatus} />
              <Info label="Total" value={`${booking.total} ${booking.currency}`} />
            </CardContent>
          </Card>

          <PartnerWarningCard
            description="Подтверждённую бронь партнёр не отменяет напрямую. Запрос отмены только фиксируется для отдельного административного решения; оплата и возврат не меняются."
            title="Правила Booking CRM"
            tone="warning"
          />

          <PartnerStatusTimeline
            description="Текущий статус читается из защищённой модели брони."
            steps={buildBookingTimeline(booking)}
            title="Status timeline"
          />

          <div className="grid gap-5 lg:grid-cols-2">
            <PartnerWarningCard
              description="Разрешённые действия партнёра выполняются через серверный атомарный контур."
              items={[
                "подтвердить новую бронь",
                "отклонить новую бронь",
                "отметить прибытие по подтверждённой брони",
                "зафиксировать проблему или запрос отмены"
              ]}
              title="Что может партнёр"
              tone="success"
            />
            <PartnerWarningCard
              description="Денежные и высокорисковые действия остаются за отдельными правилами."
              items={[
                "изменить статус оплаты",
                "отменить подтверждённую бронь напрямую",
                "запустить возврат",
                "обойти закрытую доступность"
              ]}
              title="Что партнёр не может"
              tone="danger"
            />
          </div>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <BookingSummary booking={booking} />
          <PartnerBookingActions bookingId={booking.id} backHref="/partner/bookings" status={booking.status} />
        </aside>
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

function BookingSummary({ booking }: { booking: PartnerBooking }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Summary</CardTitle>
        <CardDescription>Сумма и статус оплаты отображаются только для контроля и не меняются действиями партнёра.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <SummaryRow label="Booking ID" value={booking.id} />
        <SummaryRow label="Type" value={booking.type} />
        <SummaryRow label="Total" strong value={`${booking.total} ${booking.currency}`} />
        <div className="rounded-lg border border-border bg-background p-3 text-sm text-muted">
          Доступность и защита от overbooking остаются отдельным серверным модулем.
        </div>
      </CardContent>
    </Card>
  );
}

function Breadcrumb({ current, parentHref, parentLabel }: { current: string; parentHref: string; parentLabel: string }) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm font-medium text-muted">
        <StyledCrumb href="/partner">Кабинет партнёра</StyledCrumb>
        <span>/</span>
        <StyledCrumb href={parentHref}>{parentLabel}</StyledCrumb>
        <span>/</span>
        <span className="text-foreground">{current}</span>
      </CardContent>
    </Card>
  );
}

function StyledCrumb({ children, href }: { children: ReactNode; href: string; parentHref?: never }) {
  return (
    <a className="font-semibold text-primary transition hover:opacity-80" href={href}>
      {children}
    </a>
  );
}

function StyledLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a
      className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary"
      href={href}
    >
      {children}
    </a>
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

function SummaryRow({ label, strong, value }: { label: string; strong?: boolean; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className={strong ? "text-lg font-semibold text-primary" : "font-semibold text-foreground"}>{value}</span>
    </div>
  );
}

function NotFoundState() {
  return (
    <Card>
      <CardHeader>
        <Badge className="w-fit" variant="warning">Not found</Badge>
        <CardTitle>Бронь не найдена</CardTitle>
        <CardDescription>Бронь недоступна или не принадлежит авторизованному бизнесу.</CardDescription>
      </CardHeader>
      <CardFooter>
        <StyledLink href="/partner/bookings">Вернуться к броням</StyledLink>
      </CardFooter>
    </Card>
  );
}

function buildBookingTimeline(booking: PartnerBooking): PartnerTimelineStep[] {
  const statuses = booking.type === "stay" ? stayTimeline : tourTimeline;
  const currentIndex = statuses.findIndex((status) => status === booking.status);

  return statuses.map((status, index) => ({
    label: status,
    description: statusDescription(status, booking.type),
    status:
      status === "cancelled" || status === "rejected" || status === "no_show"
        ? "warning"
        : index < currentIndex
          ? "done"
          : index === currentIndex
            ? "current"
            : "upcoming"
  }));
}

function statusDescription(status: BookingStatus, type: PartnerBooking["type"]) {
  const descriptions: Record<BookingStatus, string> = {
    pending: "Booking waits for partner confirmation.",
    confirmed: "Partner confirmed the booking.",
    checked_in: type === "stay" ? "Client checked in to stay." : "Not used for tour flow.",
    completed: "Booking is completed.",
    cancelled: "Terminal cancellation status after an approved cancellation flow.",
    rejected: "Partner rejected the pending booking.",
    no_show: "Terminal no-show status after an approved operational flow."
  };

  return descriptions[status];
}

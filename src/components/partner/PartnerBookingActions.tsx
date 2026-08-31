import { randomUUID } from "node:crypto";
import type { ReactNode } from "react";
import { partnerBookingFormAction, type PartnerBookingAction } from "@/app/actions/partner/partnerBookings";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { BookingStatus } from "@/types";

type PartnerBookingActionsProps = {
  bookingId: string;
  status: BookingStatus;
  className?: string;
  compact?: boolean;
  detailHref?: string;
  backHref?: string;
};

const bookingFlow = ["Новая бронь", "Подтверждение", "Ожидает гостя", "Гость прибыл", "Завершение", "Админ для отмены"];

export function PartnerBookingActions({
  backHref,
  bookingId,
  className,
  compact = false,
  detailHref,
  status
}: PartnerBookingActionsProps) {
  const returnTo = backHref ? `/partner/bookings/${bookingId}` : "/partner/bookings";
  const canResolvePending = status === "pending";
  const canCheckIn = status === "confirmed";
  const canReportIssue = ["pending", "confirmed", "checked_in"].includes(status);
  const canRequestCancellation = status === "confirmed";
  const hasOperationalAction = canResolvePending || canCheckIn || canReportIssue || canRequestCancellation;

  return (
    <Card className={cn("border-primary/15 bg-background/80", className)}>
      <CardHeader className={compact ? "p-4 pb-3" : undefined}>
        <Badge className="w-fit" variant="info">Booking status actions</Badge>
        <CardTitle className={compact ? "text-base" : undefined}>Управление бронью</CardTitle>
        <CardDescription>
          Действия выполняются через защищённый серверный контур и фиксируются в истории брони или аудите.
        </CardDescription>
      </CardHeader>
      <CardContent className={cn("space-y-3", compact ? "p-4 pt-0" : undefined)}>
        <div className="flex flex-wrap gap-2">
          {bookingFlow.map((step) => (
            <Badge key={step} variant="muted">{step}</Badge>
          ))}
        </div>
        <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm font-medium text-foreground">
          Партнёр может подтверждать или отклонять новую бронь и отмечать прибытие. Запрос отмены только создаёт запись для проверки — он не отменяет бронь, не меняет оплату и не запускает возврат.
        </p>
      </CardContent>

      <CardFooter className={cn("flex flex-wrap gap-2", compact ? "p-4 pt-0" : undefined)}>
        {canResolvePending ? (
          <>
            <BookingActionForm action="confirm" bookingId={bookingId} label="Подтвердить бронь" returnTo={returnTo} />
            <BookingActionForm action="reject" bookingId={bookingId} label="Отклонить бронь" returnTo={returnTo} variant="danger" />
          </>
        ) : null}

        {canCheckIn ? (
          <BookingActionForm action="check_in" bookingId={bookingId} label="Отметить прибытие" returnTo={returnTo} variant="outline" />
        ) : null}

        {canRequestCancellation ? (
          <BookingActionForm
            action="request_cancellation"
            bookingId={bookingId}
            label="Запросить отмену"
            returnTo={returnTo}
            variant="outline"
          />
        ) : null}

        {canReportIssue ? (
          <BookingActionForm action="report_issue" bookingId={bookingId} label="Сообщить проблему" returnTo={returnTo} variant="ghost" />
        ) : null}

        {!hasOperationalAction ? (
          <Badge variant="muted">Для текущего статуса действий партнёра нет</Badge>
        ) : null}

        {detailHref ? <StyledLink href={detailHref}>Детали</StyledLink> : null}
        {backHref ? <StyledLink href={backHref}>Назад к броням</StyledLink> : null}
      </CardFooter>
    </Card>
  );
}

function BookingActionForm({
  action,
  bookingId,
  label,
  returnTo,
  variant = "primary"
}: {
  action: PartnerBookingAction;
  bookingId: string;
  label: string;
  returnTo: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
}) {
  return (
    <form action={partnerBookingFormAction}>
      <input name="bookingId" type="hidden" value={bookingId} />
      <input name="action" type="hidden" value={action} />
      <input name="requestId" type="hidden" value={`partner-booking-${randomUUID()}`} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <Button type="submit" variant={variant}>{label}</Button>
    </form>
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

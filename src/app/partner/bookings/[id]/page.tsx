import type { ReactNode } from "react";
import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerIssueEscalationPanel } from "@/app/partner/_components/PartnerIssueEscalationPanel";
import { PartnerBookingActions } from "@/components/partner/PartnerBookingActions";
import { PartnerStatusTimeline, type PartnerTimelineStep } from "@/components/partner/PartnerStatusTimeline";
import { PartnerWarningCard } from "@/components/partner/PartnerWarningCard";
import { BookingStatusBadge } from "@/components/status/BookingStatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getBookingById, getPartnerBookings } from "@/lib/data/bookings";
import type { Booking, BookingStatus } from "@/types";

type PartnerBookingDetailPageProps = {
  params: {
    id: string;
  };
};

const tourTimeline: BookingStatus[] = ["pending", "confirmed", "completed", "cancelled", "rejected", "no_show"];
const stayTimeline: BookingStatus[] = ["pending", "confirmed", "checked_in", "completed", "cancelled", "rejected", "no_show"];

export function generateStaticParams() {
  return getPartnerBookings().map((booking) => ({ id: booking.id }));
}

export default function PartnerBookingDetailPage({ params }: PartnerBookingDetailPageProps) {
  const booking = getBookingById(params.id);

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
              <Info label="Client demo" value={clientName(booking.clientUserId)} />
              <Info label="Booking type" value={booking.type === "tour" ? "tour" : "stay"} />
              <Info label="Object name" value={booking.title} />
              <Info label="Partner name" value={booking.businessId} />
              <Info label="Dates" value={`${booking.startDate}${booking.endDate ? ` - ${booking.endDate}` : ""}`} />
              <Info label="Guests" value={`${booking.guests}`} />
              <Info label="Payment method" value={booking.paymentStatus} />
              <Info label="Total" value={`${booking.total} ${booking.currency}`} />
            </CardContent>
          </Card>

          <PartnerWarningCard
            description="Подтверждённые брони нельзя отменять без admin rules. Доступность номеров и туров будет контролироваться отдельным модулем."
            title="Booking rules demo"
            tone="warning"
          />

          <PartnerStatusTimeline
            description="Possible booking CRM flow."
            steps={buildBookingTimeline(booking)}
            title="Status timeline"
          />

          <div className="grid gap-5 lg:grid-cols-2">
            <PartnerWarningCard
              description="Allowed partner actions in booking CRM."
              items={[
                "confirm booking",
                "reject booking",
                "update availability later",
                "report problem"
              ]}
              title="What partner can do"
              tone="success"
            />
            <PartnerWarningCard
              description="Actions reserved for admin rules, finance and availability protection."
              items={[
                "change payment status",
                "cancel confirmed booking without admin rules",
                "overbook closed room/tour dates"
              ]}
              title="What partner cannot do"
              tone="danger"
            />
          </div>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <BookingSummary booking={booking} />
          <PartnerBookingActions backHref="/partner/bookings" />
        </aside>
      </section>
    </PartnerLayout>
  );
}

function BookingSummary({ booking }: { booking: Booking }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Summary</CardTitle>
        <CardDescription>Booking financial demo overview.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <SummaryRow label="Booking ID" value={booking.id} />
        <SummaryRow label="Type" value={booking.type} />
        <SummaryRow label="Total" strong value={`${booking.total} ${booking.currency}`} />
        <div className="rounded-lg border border-border bg-background p-3 text-sm text-muted">
          Accepted bookings must appear in availability later. Overbooking is not allowed.
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

function StyledCrumb({ children, href }: { children: ReactNode; href: string }) {
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
        <CardDescription>В demo data нет брони с таким ID.</CardDescription>
      </CardHeader>
      <CardFooter>
        <StyledLink href="/partner/bookings">Вернуться к броням</StyledLink>
      </CardFooter>
    </Card>
  );
}

function clientName(clientUserId: string) {
  return `Client demo ${clientUserId.replace("client-", "")}`;
}

function buildBookingTimeline(booking: Booking): PartnerTimelineStep[] {
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

function statusDescription(status: BookingStatus, type: Booking["type"]) {
  const descriptions: Record<BookingStatus, string> = {
    pending: "Booking waits for partner confirmation.",
    confirmed: "Partner confirmed the booking.",
    checked_in: type === "stay" ? "Client checked in to stay." : "Not used for tour flow.",
    completed: "Booking is completed.",
    cancelled: "Possible final status after cancel flow.",
    rejected: "Possible final status if partner rejects booking.",
    no_show: "Possible final status if client does not arrive."
  };

  return descriptions[status];
}

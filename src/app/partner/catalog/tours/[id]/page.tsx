import type { ReactNode } from "react";
import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerCatalogStopRulesPanel } from "@/app/partner/catalog/_components/PartnerCatalogStopRulesPanel";
import { PartnerStopScopeCard } from "@/components/partner/PartnerStopScopeCard";
import { PartnerWarningCard } from "@/components/partner/PartnerWarningCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getTourById, getTourSchedules, getTours } from "@/lib/data/catalog";

type PageProps = {
  params: {
    id: string;
  };
};

export function generateStaticParams() {
  return getTours().map((tour) => ({ id: tour.id }));
}

export default function PartnerTourDetailPage({ params }: PageProps) {
  const tour = getTourById(params.id);

  if (!tour) {
    return <NotFoundState />;
  }

  const schedules = getTourSchedules().filter((schedule) => schedule.tourId === tour.id);

  return (
    <PartnerLayout>
      <Breadcrumb current="Detail" />
      <PartnerCatalogStopRulesPanel context="tour" />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Badge variant="info">tour</Badge>
                  <CardTitle className="mt-3 text-2xl">Управление туром</CardTitle>
                  <CardDescription>{tour.id}</CardDescription>
                </div>
                <Badge variant={tour.status === "active" ? "success" : "warning"}>{tour.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-lg font-semibold text-foreground">{tour.title}</p>
              <p className="text-sm leading-6 text-muted">{tour.description}</p>
              <div className="grid gap-3 md:grid-cols-4">
                <Info label="Price" value={`${tour.price} ${tour.currency}`} />
                <Info label="Duration" value={tour.duration} />
                <Info label="Location" value={tour.location} />
                <Info label="Rating" value={`${tour.rating}`} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Schedule demo</CardTitle>
              <CardDescription>Будущая связка с TourSchedule и календарём доступности.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {(schedules.length > 0 ? schedules : [{ id: "schedule-demo", date: "2026-07-01", startTime: "10:00", capacity: 8, bookedSeats: 3, status: "available" }]).map((schedule) => (
                <div className="rounded-lg border border-border bg-background p-4" key={schedule.id}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-foreground">{schedule.date} · {schedule.startTime}</p>
                    <Badge variant={schedule.status === "available" ? "success" : "warning"}>{schedule.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    Seats: {schedule.bookedSeats} / {schedule.capacity}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <PartnerWarningCard
            description="Stopping tour blocks new bookings only. Accepted bookings are not cancelled."
            items={[
              "New bookings for this tour are blocked",
              "Accepted bookings stay active",
              "Tour is not deleted from the system",
              "Admin rules are required for confirmed booking cancellation"
            ]}
            title="Stop rule for tour"
            tone="warning"
          />
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Visibility</CardTitle>
              <CardDescription>Public and booking status demo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Info label="Public visibility demo" value="visible" />
              <Info label="Booking status demo" value="open for new bookings" />
            </CardContent>
            <CardFooter>
              <Button>Edit demo</Button>
              <StyledLink href={`/tours/${tour.slug}`}>Preview public page demo</StyledLink>
              <StyledLink href="/partner/catalog">Back to catalog</StyledLink>
            </CardFooter>
          </Card>

          <PartnerStopScopeCard
            affectedArea={tour.title}
            description="Pause or stop new bookings for this specific tour scope."
            safetyNote="Stopping tour blocks new bookings only. Accepted bookings are not cancelled."
            scopeType="tour"
            status="active"
            title="Tour stop scope"
          />
        </aside>
      </section>
    </PartnerLayout>
  );
}

function Breadcrumb({ current }: { current: string }) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm font-medium text-muted">
        <StyledLink href="/partner">Partner</StyledLink>
        <span>/</span>
        <StyledLink href="/partner/catalog">Catalog</StyledLink>
        <span>/</span>
        <span>Tours</span>
        <span>/</span>
        <span className="text-foreground">{current}</span>
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

function StyledLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary" href={href}>
      {children}
    </a>
  );
}

function NotFoundState() {
  return (
    <PartnerLayout>
      <Card>
        <CardHeader>
          <Badge className="w-fit" variant="warning">Not found</Badge>
          <CardTitle>Тур не найден</CardTitle>
          <CardDescription>В mockTours нет тура с таким ID.</CardDescription>
        </CardHeader>
        <CardFooter>
          <StyledLink href="/partner/catalog">Back to catalog</StyledLink>
        </CardFooter>
      </Card>
    </PartnerLayout>
  );
}

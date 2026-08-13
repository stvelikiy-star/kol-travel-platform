import type { ReactNode } from "react";
import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerAvailabilityRulesPanel } from "@/app/partner/availability/_components/PartnerAvailabilityRulesPanel";
import { PartnerAvailabilityCalendarCard } from "@/components/partner/PartnerAvailabilityCalendarCard";
import { PartnerAvailabilityRuleCard } from "@/components/partner/PartnerAvailabilityRuleCard";
import { PartnerStopScopeCard } from "@/components/partner/PartnerStopScopeCard";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { getTourSchedules, getTours } from "@/lib/data/catalog";

export default function PartnerToursAvailabilityPage() {
  const tours = getTours();
  const tourSchedules = getTourSchedules();
  const closedTourDates = tourSchedules.filter((item) => item.status !== "available").length;
  const groupsWithSeats = tourSchedules.filter((item) => item.capacity - item.bookedSeats > 0).length;
  const attentionGroups = tourSchedules.filter((item) => item.capacity - item.bookedSeats <= 2).length;

  return (
    <PartnerLayout>
      <PartnerAvailabilityRulesPanel context="tours" />

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Tour schedule</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Расписание туров</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Demo управление датами, временем и местами туров. TourSchedule позже станет источником правды для туров.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium text-foreground">
          Demo cabinet без backend. Закрытая дата тура блокирует только новые брони; уже принятые брони остаются активными.
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Активные туры" value={tours.filter((tour) => tour.status === "active").length} />
        <StatCard label="Закрытые даты" value={closedTourDates} />
        <StatCard label="Группы с местами" value={groupsWithSeats} />
        <StatCard label="Требуют внимания" value={attentionGroups} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          {tours.map((tour) => {
            const schedules = tourSchedules.filter((item) => item.tourId === tour.id);

            return (
              <PartnerAvailabilityCalendarCard
                dates={(schedules.length > 0 ? schedules : [{
                  id: `${tour.id}-schedule-demo`,
                  tourId: tour.id,
                  date: "2026-07-01",
                  startTime: "10:00",
                  capacity: 8,
                  bookedSeats: 0,
                  status: "available"
                }]).map((item) => {
                  const freeSeats = item.capacity - item.bookedSeats;
                  return {
                    date: item.date,
                    label: `${item.startTime} · seats ${freeSeats}/${item.capacity}`,
                    status: item.status !== "available" ? "closed" : freeSeats <= 2 ? "limited" : "available"
                  };
                })}
                key={tour.id}
                note="Closing tour dates affects only new tour bookings. Accepted tour bookings remain active."
                title={tour.title}
                type="tour"
              />
            );
          })}
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <PartnerAvailabilityRuleCard
            rules={[
              "closed tour date blocks only new tour bookings",
              "accepted tour bookings remain active",
              "minimum/maximum guests will be controlled later"
            ]}
            title="Tour schedule rules"
            warning="TourSchedule must be checked again during checkout before a booking is created."
          />
          <PartnerStopScopeCard
            affectedArea="Demo tour schedule scope"
            description="Pause or stop new tour bookings for a selected tour/date scope."
            safetyNote="Stopping tour scope blocks new bookings only. Accepted tour bookings are not cancelled."
            scopeType="tour"
            status="active"
            title="Tour stop scope demo"
          />
          <BackLink href="/partner/availability">Назад к доступности</BackLink>
        </aside>
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
        <Badge variant="muted">tours demo</Badge>
      </CardContent>
    </Card>
  );
}

function BackLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary" href={href}>
      {children}
    </a>
  );
}

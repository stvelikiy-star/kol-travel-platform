import type { ReactNode } from "react";
import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerAvailabilityRulesPanel } from "@/app/partner/availability/_components/PartnerAvailabilityRulesPanel";
import { PartnerAvailabilityCalendarCard } from "@/components/partner/PartnerAvailabilityCalendarCard";
import { PartnerAvailabilityRuleCard } from "@/components/partner/PartnerAvailabilityRuleCard";
import { PartnerStopScopeCard } from "@/components/partner/PartnerStopScopeCard";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getPartnerAvailabilityReadResult } from "@/lib/data/partner-availability-read";

export default async function PartnerRoomsAvailabilityPage() {
  const result = await getPartnerAvailabilityReadResult();
  const { roomAvailability, rooms: allRooms, stays } = result.ok
    ? result.data
    : { roomAvailability: [], rooms: [], stays: [] };
  const closedDates = roomAvailability.filter((item) => item.status !== "available").length;
  const availableRooms = allRooms.filter((room) => room.status === "active").length;
  const limitedDates = roomAvailability.filter((item) => item.status === "booked").length;

  return (
    <PartnerLayout>
      <PartnerAvailabilityRulesPanel context="rooms" />

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Room availability</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Доступность номеров</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Read-only календарь номеров авторизованного бизнеса.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium text-foreground">
          {result.ok
            ? result.source === "mock"
              ? "Intentional mock mode. Закрытие даты блокирует только новые брони."
              : "Room availability загружена в read-only режиме для авторизованного бизнеса."
            : "Room availability недоступна: защищённое чтение завершилось fail-closed."}
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Доступные номера" value={availableRooms} />
        <StatCard label="Закрытые даты" value={closedDates} />
        <StatCard label="Ограниченная доступность" value={limitedDates} />
        <StatCard label="Принятые брони" value="demo" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          {stays.map((stay) => {
            const rooms = allRooms.filter((room) => room.stayId === stay.id);
            const dates = rooms.flatMap((room) => {
              const roomDates = roomAvailability.filter((item) => item.roomId === room.id);
              return roomDates.length > 0 || result.source !== "mock"
                ? roomDates.map((item) => ({
                    date: item.date,
                    label: `${room.title} · ${item.pricePerNight} KGS/night`,
                    status: item.status === "available" ? "available" as const : "closed" as const
                  }))
                : [{
                    date: "2026-07-01",
                    label: `${room.title} · ${room.pricePerNight} KGS/night`,
                    status: "available" as const
                  }];
            });

            return (
              <PartnerAvailabilityCalendarCard
                dates={dates.length > 0 || result.source !== "mock" ? dates : [{
                  date: "2026-07-01",
                  label: `${stay.title} · от ${stay.minPricePerNight} KGS/night`,
                  status: "available"
                }]}
                key={stay.id}
                note="Closing dates affects only new bookings. Accepted bookings are not cancelled."
                title={stay.title}
                type="room"
              />
            );
          })}
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <PartnerAvailabilityRuleCard
            rules={[
              "closed date blocks only new bookings",
              "accepted bookings are not cancelled",
              "overbooking will be prevented later by backend"
            ]}
            title="Room availability rules"
            warning="RoomAvailability must be checked again during checkout before a booking is created."
          />
          <PartnerStopScopeCard
            affectedArea="Demo room scope"
            description="Pause or stop new room bookings for a selected room/date scope."
            safetyNote="Stopping room scope blocks new bookings only. Accepted bookings are not cancelled."
            scopeType="room"
            status="active"
            title="Room stop scope demo"
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
        <Badge variant="muted">rooms</Badge>
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

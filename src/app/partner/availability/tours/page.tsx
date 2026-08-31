import type { ReactNode } from "react";
import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerAvailabilityRulesPanel } from "@/app/partner/availability/_components/PartnerAvailabilityRulesPanel";
import { PartnerAvailabilityCalendarCard } from "@/components/partner/PartnerAvailabilityCalendarCard";
import { PartnerAvailabilityRuleCard } from "@/components/partner/PartnerAvailabilityRuleCard";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { getPartnerAvailabilityReadResult } from "@/lib/data/partner-availability-read";

export const dynamic = "force-dynamic";

type PartnerToursAvailabilityPageProps = {
  searchParams?: Promise<{
    partnerAvailability?: string | string[];
    action?: string | string[];
    code?: string | string[];
  }>;
};

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PartnerToursAvailabilityPage({ searchParams }: PartnerToursAvailabilityPageProps) {
  const resolvedSearchParams = await searchParams;
  const actionState = first(resolvedSearchParams?.partnerAvailability);
  const action = first(resolvedSearchParams?.action);
  const actionCode = first(resolvedSearchParams?.code);
  const result = await getPartnerAvailabilityReadResult();
  const { tourSchedules, tours } = result.ok
    ? result.data
    : { tourSchedules: [], tours: [] };
  const closedTourDates = tourSchedules.filter((item) => item.status !== "available").length;
  const groupsWithSeats = tourSchedules.filter((item) => item.capacity - item.bookedCount > 0).length;
  const exhaustedGroups = tourSchedules.filter((item) => item.capacity - item.bookedCount <= 0).length;

  return (
    <PartnerLayout>
      <PartnerAvailabilityRulesPanel context="tours" />

      {actionState ? (
        <Card className={actionState === "success" ? "border-success/40 bg-success/10" : "border-danger/40 bg-danger/10"}>
          <CardContent className="p-4 text-sm font-medium leading-6 text-foreground" role="status">
            {actionState === "success"
              ? availabilitySuccessText(action)
              : `Действие расписания отклонено безопасно${actionCode ? `: ${actionCode}` : "."}`}
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Tour schedule</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Расписание туров</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Реальный tour_schedules авторизованного бизнеса. Закрытие слота блокирует только новые брони.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium text-foreground">
          {result.ok
            ? result.source === "mock"
              ? "Intentional mock mode. Реальные изменения недоступны."
              : "Tour schedule загружено из Supabase. Изменения проходят через ownership-scoped atomic RPC."
            : "Tour schedule недоступно: защищённое чтение завершилось fail-closed."}
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Активные туры" value={tours.filter((tour) => tour.status === "active").length} />
        <StatCard label="Закрытые слоты" value={closedTourDates} />
        <StatCard label="Слоты с местами" value={groupsWithSeats} />
        <StatCard label="Inventory исчерпан" value={exhaustedGroups} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          {tours.map((tour) => {
            const schedules = tourSchedules.filter((item) => item.tourId === tour.id);

            return (
              <PartnerAvailabilityCalendarCard
                dates={(schedules.length > 0 || result.source !== "mock" ? schedules : [{
                  id: "demo",
                  tourId: tour.id,
                  date: "2026-07-01",
                  time: "10:00",
                  capacity: 8,
                  bookedCount: 0,
                  status: "available"
                }]).map((item) => {
                  const freeSeats = item.capacity - item.bookedCount;
                  return {
                    date: item.date,
                    label: `${item.time} · seats ${freeSeats}/${item.capacity}`,
                    status: item.status !== "available" ? "closed" as const : freeSeats <= 2 ? "limited" as const : "available" as const,
                    operation: result.source === "supabase" ? {
                      scopeType: "tour_schedule" as const,
                      scopeId: item.id,
                      returnTo: "/partner/availability/tours" as const,
                      canOpen: freeSeats > 0
                    } : undefined
                  };
                })}
                key={tour.id}
                note="Закрытие слота блокирует только новые tour bookings. Подтверждённые брони, capacity, booked_count и payment truth не переписываются."
                title={tour.title}
                type="tour"
              />
            );
          })}
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <PartnerAvailabilityRuleCard
            rules={[
              "close/open изменяет только status конкретной tour_schedules строки",
              "подтверждённые брони остаются активны",
              "capacity и booked_count не восстанавливаются вручную",
              "при booked_count = capacity открытие запрещено"
            ]}
            title="Tour schedule authority"
            warning="Create booking повторно проверяет status и остаток capacity атомарно в базе данных."
          />
          <BackLink href="/partner/availability">Назад к доступности</BackLink>
        </aside>
      </section>
    </PartnerLayout>
  );
}

function availabilitySuccessText(action?: string) {
  const messages: Record<string, string> = {
    close: "Слот закрыт сервером для новых бронирований. Существующие брони не изменены.",
    open: "Слот открыт сервером без изменения capacity/booked_count.",
    report_conflict: "Конфликт расписания зафиксирован в audit trail без изменения capacity."
  };
  return messages[action ?? ""] ?? "Действие расписания подтверждено сервером.";
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="text-3xl font-semibold text-primary">{value}</p>
        <Badge variant="muted">tours</Badge>
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

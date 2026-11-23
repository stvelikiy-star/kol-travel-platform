import type { ReactNode } from "react";
import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerAvailabilityRulesPanel } from "@/app/partner/availability/_components/PartnerAvailabilityRulesPanel";
import { PartnerInventoryPublishForm } from "@/app/partner/availability/_components/PartnerInventoryPublishForm";
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
    inventory?: string | string[];
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
  const inventoryState = first(resolvedSearchParams?.inventory);
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
        <div className="bg-linear-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Расписание туров</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Расписание туров</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Реальное расписание туров вашего бизнеса. Закрытие времени отправления блокирует только новые бронирования.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium text-foreground">
          {result.ok
            ? result.source === "mock"
              ? "Демонстрационный режим. Изменение реальных данных недоступно."
              : "Расписание туров загружено из базы. Изменения проходят защищённую проверку прав партнёра."
            : "Расписание туров недоступно: безопасное чтение данных не удалось."}
        </CardContent>
      </Card>

      {inventoryState ? (
        <Card className={inventoryState === "success" ? "border-success/40 bg-success/10" : "border-danger/40 bg-danger/10"}>
          <CardContent className="p-4 text-sm font-medium text-foreground" role="status">
            {inventoryState === "success" ? "Доступность опубликована." : "Публикация отклонена. Проверьте данные и права доступа."}
          </CardContent>
        </Card>
      ) : null}
      <PartnerInventoryPublishForm
        scopeType="tour_schedule"
        enabled={result.ok && result.source === "supabase"}
        options={tours.filter((tour) => tour.status === "active").map((tour) => ({ id: tour.id, title: tour.title }))}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Активные туры" value={tours.filter((tour) => tour.status === "active").length} />
        <StatCard label="Закрытые слоты" value={closedTourDates} />
        <StatCard label="Слоты с местами" value={groupsWithSeats} />
        <StatCard label="Свободных мест нет" value={exhaustedGroups} />
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
                note="Закрытие отправления блокирует только новые бронирования тура. Подтверждённые брони, вместимость, занятые места и оплата остаются неизменными."
                title={tour.title}
                type="tour"
              />
            );
          })}
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <PartnerAvailabilityRuleCard
            rules={[
              "Открытие и закрытие меняет только статус выбранного отправления",
              "подтверждённые брони остаются активны",
              "Вместимость и число забронированных мест вручную не восстанавливаются",
              "Если все места заняты, открыть отправление нельзя"
            ]}
            title="Управление расписанием туров"
            warning="При создании брони сервер повторно проверяет статус отправления и свободные места."
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
    open: "Время отправления открыто без изменения вместимости и занятых мест.",
    report_conflict: "Конфликт расписания записан в журнал без изменения вместимости."
  };
  return messages[action ?? ""] ?? "Действие расписания подтверждено сервером.";
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="text-3xl font-semibold text-primary">{value}</p>
        <Badge variant="muted">Туры</Badge>
      </CardContent>
    </Card>
  );
}

function BackLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-xs transition hover:border-primary hover:text-primary" href={href}>
      {children}
    </a>
  );
}

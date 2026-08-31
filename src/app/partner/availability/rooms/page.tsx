import type { ReactNode } from "react";
import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerAvailabilityRulesPanel } from "@/app/partner/availability/_components/PartnerAvailabilityRulesPanel";
import { PartnerAvailabilityCalendarCard } from "@/components/partner/PartnerAvailabilityCalendarCard";
import { PartnerAvailabilityRuleCard } from "@/components/partner/PartnerAvailabilityRuleCard";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { getPartnerAvailabilityReadResult } from "@/lib/data/partner-availability-read";

export const dynamic = "force-dynamic";

type PartnerRoomsAvailabilityPageProps = {
  searchParams?: Promise<{
    partnerAvailability?: string | string[];
    action?: string | string[];
    code?: string | string[];
  }>;
};

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PartnerRoomsAvailabilityPage({ searchParams }: PartnerRoomsAvailabilityPageProps) {
  const resolvedSearchParams = await searchParams;
  const actionState = first(resolvedSearchParams?.partnerAvailability);
  const action = first(resolvedSearchParams?.action);
  const actionCode = first(resolvedSearchParams?.code);
  const result = await getPartnerAvailabilityReadResult();
  const { roomAvailability, rooms: allRooms, stays } = result.ok
    ? result.data
    : { roomAvailability: [], rooms: [], stays: [] };
  const closedDates = roomAvailability.filter((item) => item.status !== "available").length;
  const availableRooms = allRooms.filter((room) => room.status === "active").length;
  const exhaustedDates = roomAvailability.filter((item) => item.availableCount <= 0).length;

  return (
    <PartnerLayout>
      <PartnerAvailabilityRulesPanel context="rooms" />

      {actionState ? (
        <Card className={actionState === "success" ? "border-success/40 bg-success/10" : "border-danger/40 bg-danger/10"}>
          <CardContent className="p-4 text-sm font-medium leading-6 text-foreground" role="status">
            {actionState === "success"
              ? availabilitySuccessText(action)
              : `Действие доступности отклонено безопасно${actionCode ? `: ${actionCode}` : "."}`}
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Room availability</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Доступность номеров</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Реальный календарь room_availability авторизованного бизнеса. Открытие и закрытие меняет только будущий спрос.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium text-foreground">
          {result.ok
            ? result.source === "mock"
              ? "Intentional mock mode. Реальные изменения недоступны."
              : "Room availability загружена из Supabase. Изменения проходят через ownership-scoped atomic RPC."
            : "Room availability недоступна: защищённое чтение завершилось fail-closed."}
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Активные номера" value={availableRooms} />
        <StatCard label="Закрытые даты" value={closedDates} />
        <StatCard label="Inventory исчерпан" value={exhaustedDates} />
        <StatCard label="Строки календаря" value={roomAvailability.length} />
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
                    label: `${room.title} · ${item.pricePerNight} KGS/night · свободно ${item.availableCount}`,
                    status: item.status === "available" ? "available" as const : "closed" as const,
                    operation: result.source === "supabase" ? {
                      scopeType: "room_date" as const,
                      scopeId: item.id,
                      returnTo: "/partner/availability/rooms" as const,
                      canOpen: item.availableCount > 0
                    } : undefined
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
                note="Закрытие даты блокирует только новые брони. Подтверждённые брони, payment truth, available_count и price_override не переписываются."
                title={stay.title}
                type="room"
              />
            );
          })}
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <PartnerAvailabilityRuleCard
            rules={[
              "close/open изменяет только status конкретной room_availability строки",
              "подтверждённые брони не отменяются",
              "available_count и price_override не восстанавливаются вручную",
              "при available_count = 0 открытие запрещено"
            ]}
            title="Room availability authority"
            warning="Create booking повторно проверяет status и available_count атомарно в базе данных."
          />
          <BackLink href="/partner/availability">Назад к доступности</BackLink>
        </aside>
      </section>
    </PartnerLayout>
  );
}

function availabilitySuccessText(action?: string) {
  const messages: Record<string, string> = {
    close: "Дата закрыта сервером для новых бронирований. Существующие брони не изменены.",
    open: "Дата открыта сервером для новых бронирований без изменения inventory-счётчика.",
    report_conflict: "Конфликт доступности зафиксирован в audit trail без изменения inventory."
  };
  return messages[action ?? ""] ?? "Действие доступности подтверждено сервером.";
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

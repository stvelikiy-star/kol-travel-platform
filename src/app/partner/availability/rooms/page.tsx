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

type PartnerRoomsAvailabilityPageProps = {
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

export default async function PartnerRoomsAvailabilityPage({ searchParams }: PartnerRoomsAvailabilityPageProps) {
  const resolvedSearchParams = await searchParams;
  const actionState = first(resolvedSearchParams?.partnerAvailability);
  const action = first(resolvedSearchParams?.action);
  const actionCode = first(resolvedSearchParams?.code);
  const inventoryState = first(resolvedSearchParams?.inventory);
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
        <div className="bg-linear-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Доступность номеров</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Доступность номеров</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Реальный календарь свободных номеров вашего бизнеса. Открытие и закрытие дат влияет только на новые бронирования.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium text-foreground">
          {result.ok
            ? result.source === "mock"
              ? "Демонстрационный режим. Изменение реальных данных недоступно."
              : "Доступность номеров загружена из базы. Изменения проходят защищённую проверку прав партнёра."
            : "Доступность номеров недоступна: безопасное чтение данных не удалось."}
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
        scopeType="room_date"
        enabled={result.ok && result.source === "supabase"}
        options={allRooms.filter((room) => room.status === "active").map((room) => ({ id: room.id, title: room.title }))}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Активные номера" value={availableRooms} />
        <StatCard label="Закрытые даты" value={closedDates} />
        <StatCard label="Свободных мест нет" value={exhaustedDates} />
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
                    label: `${room.title} · ${item.pricePerNight} сом/ночь · свободно ${item.availableCount}`,
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
                    label: `${room.title} · ${room.pricePerNight} сом/ночь`,
                    status: "available" as const,
                    operation: undefined
                  }];
            });

            return (
              <PartnerAvailabilityCalendarCard
                dates={dates.length > 0 || result.source !== "mock" ? dates : [{
                  date: "2026-07-01",
                  label: `${stay.title} · от ${stay.minPricePerNight} сом/ночь`,
                  status: "available"
                }]}
                key={stay.id}
                note="Закрытие даты блокирует только новые бронирования. Подтверждённые брони, оплаты, количество мест и цены остаются неизменными."
                title={stay.title}
                type="room"
              />
            );
          })}
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <PartnerAvailabilityRuleCard
            rules={[
              "Открытие и закрытие меняет только статус выбранной даты номера",
              "подтверждённые брони не отменяются",
              "Количество свободных мест и цена вручную не восстанавливаются",
              "Если свободных мест нет, открыть дату нельзя"
            ]}
            title="Управление доступностью номеров"
            warning="При создании брони сервер повторно проверяет статус даты и свободные места."
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
    open: "Дата открыта для новых бронирований без изменения количества мест.",
    report_conflict: "Конфликт доступности записан в журнал без изменения количества мест."
  };
  return messages[action ?? ""] ?? "Действие доступности подтверждено сервером.";
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="text-3xl font-semibold text-primary">{value}</p>
        <Badge variant="muted">Номера</Badge>
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

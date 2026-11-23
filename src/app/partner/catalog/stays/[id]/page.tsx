import { displayBusinessStatus } from "@/lib/i18n/status-labels";
import type { ReactNode } from "react";
import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerCatalogStopRulesPanel } from "@/app/partner/catalog/_components/PartnerCatalogStopRulesPanel";
import { PartnerStopScopeCard } from "@/components/partner/PartnerStopScopeCard";
import { PartnerWarningCard } from "@/components/partner/PartnerWarningCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getPartnerAvailabilityReadResult } from "@/lib/data/partner-availability-read";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export function generateStaticParams() {
  return [];
}

export default async function PartnerStayDetailPage({ params }: PageProps) {
  const { id } = await params;
  const result = await getPartnerAvailabilityReadResult();
  const stay = result.ok ? result.data.stays.find((item) => item.id === id) : undefined;

  if (!stay) {
    return <NotFoundState />;
  }

  const rooms = result.ok ? result.data.rooms.filter((room) => room.stayId === stay.id) : [];
  const primaryRoom = rooms[0];
  const availability = primaryRoom && result.ok
    ? result.data.roomAvailability.filter((item) => item.roomId === primaryRoom.id)
    : [];

  return (
    <PartnerLayout>
      <Breadcrumb current="Детали" />
      <PartnerCatalogStopRulesPanel context="stay" />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Badge variant="info">Жильё и номер</Badge>
                  <CardTitle className="mt-3 text-2xl">Управление жильём / номером</CardTitle>
                  <CardDescription>{stay.id}</CardDescription>
                </div>
                <Badge variant={stay.status === "active" ? "success" : "warning"}>{displayBusinessStatus(stay.status)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-lg font-semibold text-foreground">{stay.title}</p>
              <p className="text-sm leading-6 text-muted">{stay.description}</p>
              <div className="grid gap-3 md:grid-cols-4">
                <Info label="Цена за ночь" value={`${stay.minPricePerNight} ${stay.currency}`} />
                <Info label="Тип номера (демо)" value={primaryRoom?.title ?? stay.type} />
                <Info label="Вместимость" value={`${primaryRoom?.capacity ?? 2} гостей`} />
                <Info label="Расположение" value={stay.location} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Доступность</CardTitle>
              <CardDescription>Доступность номеров этого бизнеса доступна только для просмотра.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {(availability.length > 0 || result.source !== "mock" ? availability : [{ roomId: primaryRoom?.id ?? "availability-demo", date: "2026-07-01", status: "available", availableCount: 1, priceOverride: null, pricePerNight: stay.minPricePerNight }]).map((item) => (
                <div className="rounded-lg border border-border bg-background p-4" key={`${item.roomId}:${item.date}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-foreground">{item.date}</p>
                    <Badge variant={item.status === "available" ? "success" : "warning"}>{displayBusinessStatus(item.status)}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted">{item.pricePerNight} KGS за ночь</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <PartnerWarningCard
            description="Остановка номера блокирует только новые бронирования. Принятые бронирования сохраняются."
            items={[
              "Новые бронирования этого номера заблокированы",
              "Принятые бронирования сохраняются",
              "Номер не удаляется",
              "Изменение дат регулируется правилами администратора и поддержки"
            ]}
            title="Правила остановки номера"
            tone="warning"
          />
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Правила бронирования (демо)</CardTitle>
              <CardDescription>Демонстрационные правила будущей системы бронирований без изменения данных.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Info label="Подтверждение" value="подтверждение партнёром" />
              <Info label="Отмена" value="по правилам поддержки и администратора" />
            </CardContent>
            <CardFooter>
              <Button>Редактировать (демо)</Button>
              <StyledLink href={`/stays/${stay.slug}`}>Просмотреть публичную страницу (демо)</StyledLink>
              <StyledLink href="/partner/catalog">Назад к каталогу</StyledLink>
            </CardFooter>
          </Card>

          <PartnerStopScopeCard
            affectedArea={primaryRoom?.title ?? stay.title}
            description="Приостановить новые бронирования для выбранного номера."
            safetyNote="Остановка номера блокирует только новые бронирования. Принятые бронирования сохраняются."
            scopeType="room"
            status="active"
            title="Остановка бронирования номера"
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
        <StyledLink href="/partner">Партнёр</StyledLink>
        <span>/</span>
        <StyledLink href="/partner/catalog">Каталог</StyledLink>
        <span>/</span>
        <span>Жильё</span>
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
    <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-xs transition hover:border-primary hover:text-primary" href={href}>
      {children}
    </a>
  );
}

function NotFoundState() {
  return (
    <PartnerLayout>
      <Card>
        <CardHeader>
          <Badge className="w-fit" variant="warning">Не найдено</Badge>
          <CardTitle>Жильё не найдено</CardTitle>
          <CardDescription>Объект недоступен или не принадлежит авторизованному бизнесу.</CardDescription>
        </CardHeader>
        <CardFooter>
          <StyledLink href="/partner/catalog">Назад к каталогу</StyledLink>
        </CardFooter>
      </Card>
    </PartnerLayout>
  );
}

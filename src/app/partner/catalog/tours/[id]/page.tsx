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

export default async function PartnerTourDetailPage({ params }: PageProps) {
  const { id } = await params;
  const result = await getPartnerAvailabilityReadResult();
  const tour = result.ok ? result.data.tours.find((item) => item.id === id) : undefined;

  if (!tour) {
    return <NotFoundState />;
  }

  const schedules = result.ok ? result.data.tourSchedules.filter((schedule) => schedule.tourId === tour.id) : [];

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
                  <Badge variant="info">Тур</Badge>
                  <CardTitle className="mt-3 text-2xl">Управление туром</CardTitle>
                  <CardDescription>{tour.id}</CardDescription>
                </div>
                <Badge variant={tour.status === "active" ? "success" : "warning"}>{displayBusinessStatus(tour.status)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-lg font-semibold text-foreground">{tour.title}</p>
              <p className="text-sm leading-6 text-muted">{tour.description}</p>
              <div className="grid gap-3 md:grid-cols-4">
                <Info label="Цена" value={`${tour.price} ${tour.currency}`} />
                <Info label="Продолжительность" value={tour.duration} />
                <Info label="Расположение" value={tour.location} />
                <Info label="Статус" value={displayBusinessStatus(tour.status)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Расписание</CardTitle>
              <CardDescription>Расписание туров этого бизнеса доступно только для просмотра.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {(schedules.length > 0 || result.source !== "mock" ? schedules : [{ tourId: tour.id, date: "2026-07-01", time: "10:00", capacity: 8, bookedCount: 3, status: "available" }]).map((schedule) => (
                <div className="rounded-lg border border-border bg-background p-4" key={`${schedule.tourId}:${schedule.date}:${schedule.time}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-foreground">{schedule.date} · {schedule.time}</p>
                    <Badge variant={schedule.status === "available" ? "success" : "warning"}>{displayBusinessStatus(schedule.status)}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    Seats: {schedule.bookedCount} / {schedule.capacity}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <PartnerWarningCard
            description="Остановка тура блокирует только новые бронирования. Принятые бронирования сохраняются."
            items={[
              "New bookings for this tour are blocked",
              "Accepted bookings stay active",
              "Tour is not deleted from the system",
              "Admin rules are required for confirmed booking cancellation"
            ]}
            title="Правила остановки тура"
            tone="warning"
          />
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Видимость</CardTitle>
              <CardDescription>Демонстрация видимости и статуса бронирования.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Info label="Видимость на сайте (демо)" value="отображается" />
              <Info label="Статус бронирования (демо)" value="открыто для новых бронирований" />
            </CardContent>
            <CardFooter>
              <Button>Редактировать (демо)</Button>
              <StyledLink href={`/tours/${tour.slug}`}>Просмотреть публичную страницу (демо)</StyledLink>
              <StyledLink href="/partner/catalog">Назад к каталогу</StyledLink>
            </CardFooter>
          </Card>

          <PartnerStopScopeCard
            affectedArea={tour.title}
            description="Приостановить новые бронирования выбранного тура."
            safetyNote="Остановка тура блокирует только новые бронирования. Принятые бронирования сохраняются."
            scopeType="tour"
            status="active"
            title="Остановка бронирования тура"
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
          <CardTitle>Тур не найден</CardTitle>
          <CardDescription>Тур недоступен или не принадлежит авторизованному бизнесу.</CardDescription>
        </CardHeader>
        <CardFooter>
          <StyledLink href="/partner/catalog">Назад к каталогу</StyledLink>
        </CardFooter>
      </Card>
    </PartnerLayout>
  );
}

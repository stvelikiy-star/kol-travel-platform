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
  params: {
    id: string;
  };
};

export function generateStaticParams() {
  return [];
}

export default async function PartnerStayDetailPage({ params }: PageProps) {
  const result = await getPartnerAvailabilityReadResult();
  const stay = result.ok ? result.data.stays.find((item) => item.id === params.id) : undefined;

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
      <Breadcrumb current="Detail" />
      <PartnerCatalogStopRulesPanel context="stay" />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Badge variant="info">stay / room</Badge>
                  <CardTitle className="mt-3 text-2xl">Управление жильём / номером</CardTitle>
                  <CardDescription>{stay.id}</CardDescription>
                </div>
                <Badge variant={stay.status === "active" ? "success" : "warning"}>{stay.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-lg font-semibold text-foreground">{stay.title}</p>
              <p className="text-sm leading-6 text-muted">{stay.description}</p>
              <div className="grid gap-3 md:grid-cols-4">
                <Info label="Price per night" value={`${stay.minPricePerNight} ${stay.currency}`} />
                <Info label="Room type demo" value={primaryRoom?.title ?? stay.type} />
                <Info label="Capacity" value={`${primaryRoom?.capacity ?? 2} guests`} />
                <Info label="Location" value={stay.location} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Availability</CardTitle>
              <CardDescription>Read-only RoomAvailability для этого бизнеса.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {(availability.length > 0 || result.source !== "mock" ? availability : [{ id: "availability-demo", date: "2026-07-01", status: "available", pricePerNight: stay.minPricePerNight }]).map((item) => (
                <div className="rounded-lg border border-border bg-background p-4" key={item.id}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-foreground">{item.date}</p>
                    <Badge variant={item.status === "available" ? "success" : "warning"}>{item.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted">{item.pricePerNight} KGS / night</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <PartnerWarningCard
            description="Stopping room blocks new bookings only. Accepted bookings are not cancelled."
            items={[
              "New bookings for this room are blocked",
              "Accepted bookings stay active",
              "Room is not deleted",
              "Date changes require admin/support rules"
            ]}
            title="Stop rule for room"
            tone="warning"
          />
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Booking rules demo</CardTitle>
              <CardDescription>UI-only partner rules for future booking CRM.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Info label="Confirmation" value="manual partner confirmation" />
              <Info label="Cancellation" value="through support/admin rules" />
            </CardContent>
            <CardFooter>
              <Button>Edit demo</Button>
              <StyledLink href={`/stays/${stay.slug}`}>Preview public page demo</StyledLink>
              <StyledLink href="/partner/catalog">Back to catalog</StyledLink>
            </CardFooter>
          </Card>

          <PartnerStopScopeCard
            affectedArea={primaryRoom?.title ?? stay.title}
            description="Pause or stop new bookings for this room scope."
            safetyNote="Stopping room blocks new bookings only. Accepted bookings are not cancelled."
            scopeType="room"
            status="active"
            title="Room stop scope"
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
        <span>Stays</span>
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
          <CardTitle>Жильё не найдено</CardTitle>
          <CardDescription>Объект недоступен или не принадлежит авторизованному бизнесу.</CardDescription>
        </CardHeader>
        <CardFooter>
          <StyledLink href="/partner/catalog">Back to catalog</StyledLink>
        </CardFooter>
      </Card>
    </PartnerLayout>
  );
}

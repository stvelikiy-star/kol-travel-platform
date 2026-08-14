import type { ReactNode } from "react";
import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerAvailabilityRulesPanel } from "@/app/partner/availability/_components/PartnerAvailabilityRulesPanel";
import { PartnerAvailabilityCalendarCard } from "@/components/partner/PartnerAvailabilityCalendarCard";
import { PartnerAvailabilityRuleCard } from "@/components/partner/PartnerAvailabilityRuleCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getFood, getProducts } from "@/lib/data/catalog";
import { getPartnerAvailabilityReadResult } from "@/lib/data/partner-availability-read";

const workingHours = [
  { date: "Пн-Пт", label: "09:00 - 22:00", status: "available" as const },
  { date: "Сб", label: "10:00 - 23:00", status: "limited" as const },
  { date: "Вс", label: "Закрыто для demo", status: "closed" as const }
];

export default async function PartnerAvailabilityPage() {
  const result = await getPartnerAvailabilityReadResult();
  const { roomAvailability, rooms, tourSchedules, tours } = result.ok
    ? result.data
    : { roomAvailability: [], rooms: [], tourSchedules: [], tours: [] };
  const foodItems = result.ok && result.source === "mock" ? getFood() : [];
  const products = result.ok && result.source === "mock" ? getProducts() : [];
  const availableRooms = roomAvailability.filter((item) => item.status === "available").length;
  const closedDates = roomAvailability.filter((item) => item.status !== "available").length;
  const activeTours = tourSchedules.filter((item) => item.status === "available").length;

  return (
    <PartnerLayout>
      <PartnerAvailabilityRulesPanel context="overview" />

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Availability CRM</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Доступность</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Read-only доступность номеров и расписание туров авторизованного бизнеса.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium text-foreground">
          {result.ok
            ? result.source === "mock"
              ? "Intentional mock mode. Закрытие даты блокирует только новые заявки."
              : "Данные загружены в read-only режиме для авторизованного бизнеса."
            : "Доступность не загружена: авторизация, ownership или защищённое чтение не подтверждены."}
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Доступные номера" value={availableRooms} />
        <StatCard label="Закрытые даты" value={closedDates} />
        <StatCard label="Активные туры" value={activeTours} />
        <StatCard label="Рабочие часы" value="6/7" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <NavigationCard
          description="Детальная доступность номеров, закрытые даты и stop room scope."
          href="/partner/availability/rooms"
          title="Номера"
        />
        <NavigationCard
          description="Расписание туров, места в группах и stop tour scope."
          href="/partner/availability/tours"
          title="Туры"
        />
        <NavigationCard
          description="Рабочие часы, доступность блюд и stop food item scope."
          href="/partner/availability/food"
          title="Еда и меню"
        />
        <NavigationCard
          description="Наличие товаров, stock demo и stop product scope."
          href="/partner/availability/products"
          title="Товары"
        />
      </section>

      <PartnerAvailabilityRuleCard
        rules={[
          "If room/tour date is closed, it must not appear as available for new bookings later.",
          "Accepted existing bookings must not be cancelled by closing dates.",
          "RoomAvailability and TourSchedule will be checked again during checkout."
        ]}
        title="Важное правило бронирований"
        warning="Backend protection from overbooking will be connected later."
      />

      <section className="grid gap-4 xl:grid-cols-2">
        <PartnerAvailabilityCalendarCard
          dates={roomAvailability.map((item) => {
            const room = rooms.find((entry) => entry.id === item.roomId);
            return {
              date: item.date,
              label: `${room?.title ?? item.roomId} · ${item.pricePerNight} KGS`,
              status: item.status === "available" ? "available" : "closed"
            };
          })}
          title="Жильё: room availability"
          type="room"
        />

        <PartnerAvailabilityCalendarCard
          dates={tourSchedules.map((item) => {
            const tour = tours.find((entry) => entry.id === item.tourId);
            const freeSeats = item.capacity - item.bookedSeats;
            return {
              date: item.date,
              label: `${tour?.title ?? item.tourId} · ${item.startTime} · мест: ${freeSeats}/${item.capacity}`,
              status: item.status === "available" && freeSeats > 3 ? "available" : item.status === "available" ? "limited" : "closed"
            };
          })}
          title="Туры: tour schedule"
          type="tour"
        />

        {result.ok && result.source === "mock" ? (
          <>
            <PartnerAvailabilityCalendarCard
              dates={workingHours}
              title="Еда: restaurant working hours demo"
              type="restaurant"
            />

            <PartnerAvailabilityCalendarCard
              dates={products.slice(0, 4).map((product) => ({
                date: product.category,
                label: product.title,
                status: product.status === "active" ? "available" : product.status === "out_of_stock" ? "limited" : "stopped"
              }))}
              note={`Food items demo count: ${foodItems.length}. Product availability affects only new orders.`}
              title="Магазин: product availability demo"
              type="product"
            />
          </>
        ) : null}
      </section>
    </PartnerLayout>
  );
}

function NavigationCard({ description, href, title }: { description: string; href: string; title: string }) {
  return (
    <Card>
      <CardHeader>
        <Badge className="w-fit" variant="info">detail page</Badge>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardFooter>
        <StyledLink href={href}>Открыть {title.toLowerCase()}</StyledLink>
      </CardFooter>
    </Card>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="text-3xl font-semibold text-primary">{value}</p>
        <Badge variant="muted">availability</Badge>
      </CardContent>
    </Card>
  );
}

function StyledLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90" href={href}>
      {children}
    </a>
  );
}

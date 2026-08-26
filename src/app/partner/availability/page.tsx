import Link from "next/link";
import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerAvailabilityCalendarCard } from "@/components/partner/PartnerAvailabilityCalendarCard";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getPartnerAvailabilityReadResult } from "@/lib/data/partner-availability-read";

export default async function PartnerAvailabilityPage() {
  const result = await getPartnerAvailabilityReadResult();
  const data = result.ok ? result.data : { roomAvailability: [], rooms: [], tourSchedules: [], tours: [], stays: [] };
  const availableRooms = data.roomAvailability.filter((item) => item.status === "available").length;
  const closedDates = data.roomAvailability.filter((item) => item.status !== "available").length;
  const activeTours = data.tourSchedules.filter((item) => item.status === "available").length;
  const sourceLabel = result.source === "supabase" ? "Подтверждённые данные" : "Безопасное демо";

  return (
    <PartnerLayout>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">KÖL Availability</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Доступность</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Партнёр видит доступность своих номеров и расписание туров в одном рабочем контуре. Данные других бизнесов и неподтверждённые остатки не подставляются.
          </p>
        </div>
      </Card>

      <Card className={result.ok ? "border-primary/20 bg-surface" : "border-danger/40 bg-danger/10"}>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <Badge variant={result.source === "supabase" ? "success" : "info"}>{sourceLabel}</Badge>
          <p className="max-w-3xl leading-6 text-muted">
            {result.ok
              ? result.source === "supabase"
                ? "Загружена доступность текущего бизнеса."
                : "Демо показывает структуру управления доступностью без изменения production-данных."
              : "Доступность временно недоступна. KÖL не подменяет её общими или выдуманными значениями."}
          </p>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Доступные даты жилья" value={result.ok ? availableRooms : "—"} />
        <StatCard label="Закрытые даты жилья" value={result.ok ? closedDates : "—"} />
        <StatCard label="Активные выезды туров" value={result.ok ? activeTours : "—"} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <NavigationCard description="Детальная доступность номеров и дат." href="/partner/availability/rooms" title="Номера" />
        <NavigationCard description="Расписание туров и доступные места." href="/partner/availability/tours" title="Туры" />
        <NavigationCard description="Доступность блюд и позиций меню текущего бизнеса." href="/partner/availability/food" title="Еда и меню" />
        <NavigationCard description="Остатки и доступность товаров текущего бизнеса." href="/partner/availability/products" title="Товары" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <PartnerAvailabilityCalendarCard
          dates={data.roomAvailability.map((item) => {
            const room = data.rooms.find((entry) => entry.id === item.roomId);
            return { date: item.date, label: `${room?.title ?? item.roomId} · ${item.priceOverride ?? item.pricePerNight} KGS`, status: item.status === "available" ? "available" : "closed" };
          })}
          title="Жильё: календарь доступности"
          type="room"
        />

        <PartnerAvailabilityCalendarCard
          dates={data.tourSchedules.map((item) => {
            const tour = data.tours.find((entry) => entry.id === item.tourId);
            const freeSeats = Math.max(0, item.capacity - item.bookedCount);
            return { date: item.date, label: `${tour?.title ?? item.tourId} · ${item.time} · ${freeSeats}/${item.capacity}`, status: item.status === "available" && freeSeats > 0 ? "available" : "closed" };
          })}
          title="Туры: расписание и места"
          type="tour"
        />
      </section>

      <Card className="border-primary/20 bg-lake-light">
        <CardHeader>
          <CardTitle>Изменения доступности защищены</CardTitle>
          <CardDescription>Открытие и закрытие дат, изменение остатков и рабочих часов выполняются через отдельные серверные операции с проверкой принадлежности бизнеса и журналом изменений.</CardDescription>
        </CardHeader>
      </Card>
    </PartnerLayout>
  );
}

function NavigationCard({ description, href, title }: { description: string; href: string; title: string }) {
  return <Card><CardHeader><Badge className="w-fit" variant="info">Детали</Badge><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardFooter><StyledLink href={href}>Открыть {title.toLowerCase()}</StyledLink></CardFooter></Card>;
}
function StatCard({ label, value }: { label: string; value: string | number }) { return <Card><CardContent className="space-y-3 p-5"><p className="text-sm font-medium text-muted">{label}</p><p className="text-3xl font-semibold text-primary">{value}</p><Badge variant="muted">Доступность</Badge></CardContent></Card>; }
function StyledLink({ children, href }: { children: React.ReactNode; href: string }) { return <Link className="inline-flex min-h-11 items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90" href={href}>{children}</Link>; }

import { RealTourBookingPanel } from "@/components/booking/RealTourBookingPanel";
import { TourBookingPanel } from "@/components/booking/TourBookingPanel";
import { EmptyState } from "@/components/catalog/EmptyState";
import { TourCard } from "@/components/cards/TourCard";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getPublicTourDetailReadResult } from "@/lib/data/public-booking-detail-read";
import { getPartnerById } from "@/lib/data/partners";
import { tourImage } from "@/lib/presentation-media";

type TourDetailPageProps = { params: Promise<{ slug: string }> };

export default async function TourDetailPage({ params }: TourDetailPageProps) {
  const { slug } = await params;
  const result = await getPublicTourDetailReadResult(slug);
  const tour = result.tour;

  if (!result.ok || !tour) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <PublicHeader />
        <Container className="py-10">
          <EmptyState actionLabel="Вернуться к турам" description="Тур не найден или сейчас недоступен для бронирования." href="/tours" title="Тур не найден" />
        </Container>
        <PublicFooter />
      </main>
    );
  }

  const partner = result.source === "mock" ? getPartnerById(tour.businessId) : undefined;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="space-y-10 py-10">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2"><Badge>{tour.location}</Badge><Badge variant="info">{tour.duration}</Badge><Badge variant="success">★ {tour.rating}</Badge></div>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">{tour.title}</h1>
            <p className="text-lg leading-8 text-muted">{tour.description}</p>
            <div className="flex flex-wrap items-center gap-4">
              <p className="text-3xl font-semibold">{tour.price} {tour.currency}</p>
              <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-primary bg-primary px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90" href="#booking">Выбрать дату</a>
            </div>
          </div>

          <div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-cover bg-center shadow-soft" style={{ backgroundImage: `url("${tourImage(tour)}")` }}>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5 text-white">
              <p className="text-2xl font-semibold">{partner?.title ?? "KÖL Partner"}</p>
              <Badge className="border-white/40 bg-white text-primary">{tour.status}</Badge>
            </div>
          </div>
        </section>

        <section className="scroll-mt-28" id="booking">
          {result.source === "mock" ? (
            <TourBookingPanel schedules={result.schedules} tour={tour} />
          ) : result.inventoryOk && result.schedules.length > 0 ? (
            <RealTourBookingPanel schedules={result.schedules} tour={tour} />
          ) : (
            <Card><CardHeader><CardTitle>Онлайн-бронирование</CardTitle></CardHeader><CardContent className="text-sm text-muted"><p>Свободные даты сейчас уточняются. Мы не показываем неподтверждённое количество мест.</p></CardContent></Card>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <Card>
            <CardHeader><CardTitle>О туре</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted"><p>{tour.description}</p><p>Продолжительность: {tour.duration}</p><p>Локация: {tour.location}</p><p>Стоимость указана за одного участника.</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Расписание и места</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {result.schedules.length > 0 ? result.schedules.map((schedule) => (
                <div className="rounded-md bg-background p-3 text-sm" key={schedule.id}><p className="font-semibold">{schedule.date}{schedule.startTime ? ` · ${schedule.startTime}` : ""}</p><p className="text-muted">Свободно: {Math.max(schedule.capacity - schedule.bookedSeats, 0)} из {schedule.capacity}</p></div>
              )) : <p className="text-sm text-muted">Свободные даты уточняются.</p>}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-5">
          <SectionTitle title="Похожие туры" description="Другие впечатления и маршруты по Иссык-Кулю." />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{result.similarTours.map((item) => <TourCard key={item.id} tour={item} />)}</div>
        </section>
      </Container>
      <PublicFooter />
    </main>
  );
}

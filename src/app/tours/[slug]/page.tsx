import { EmptyState } from "@/components/catalog/EmptyState";
import { TourBookingPanel } from "@/components/booking/TourBookingPanel";
import { TourCard } from "@/components/cards/TourCard";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getTourById, getTourSchedules, getTours } from "@/lib/data/catalog";
import { getPartnerById } from "@/lib/data/partners";

type TourDetailPageProps = {
  params: {
    slug: string;
  };
};

export function generateStaticParams() {
  return getTours().map((tour) => ({ slug: tour.slug }));
}

export default function TourDetailPage({ params }: TourDetailPageProps) {
  const tour = getTourById(params.slug);

  if (!tour) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <PublicHeader />
        <Container className="py-10">
          <EmptyState
            actionLabel="Вернуться к турам"
            description="Такого тура нет в mock-каталоге или ссылка устарела."
            href="/tours"
            title="Тур не найден"
          />
        </Container>
        <PublicFooter />
      </main>
    );
  }

  const partner = getPartnerById(tour.businessId);
  const schedules = getTourSchedules().filter((schedule) => schedule.tourId === tour.id);
  const similarTours = getTours().filter((item) => item.id !== tour.id).slice(0, 3);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="space-y-10 py-10">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge>{tour.location}</Badge>
              <Badge variant="info">{tour.duration}</Badge>
              <Badge variant="success">★ {tour.rating}</Badge>
            </div>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">{tour.title}</h1>
            <p className="text-lg leading-8 text-muted">{tour.description}</p>
            <div className="flex flex-wrap items-center gap-4">
              <p className="text-3xl font-semibold">
                {tour.price} {tour.currency}
              </p>
              <Button>Забронировать тур</Button>
            </div>
          </div>

          <div className="aspect-[4/3] rounded-lg bg-gradient-to-br from-primary via-secondary to-accent p-5 text-white">
            <div className="flex h-full flex-col justify-between">
              <Badge className="border-white/40 bg-white text-primary">{tour.status}</Badge>
              <p className="text-2xl font-semibold">{partner?.title ?? "KÖL Partner"}</p>
            </div>
          </div>
        </section>

        <TourBookingPanel schedules={schedules} tour={tour} />

        <section className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Что входит</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted">
              <p>Сопровождение гида</p>
              <p>Организация маршрута</p>
              <p>Базовая консультация перед поездкой</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Что не входит</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted">
              <p>Личные расходы</p>
              <p>Питание вне программы</p>
              <p>Индивидуальный трансфер, если не указан</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Правила отмены</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-muted">
              Отмена и перенос пока описаны как UI placeholder. Финальные правила задаются партнёром.
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Маршрут</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted">
              <p>1. Встреча с гидом или партнёром</p>
              <p>2. Основная часть маршрута</p>
              <p>3. Фото-точки и свободное время</p>
              <p>4. Возвращение в точку старта</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Расписание и места</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {schedules.length > 0 ? (
                schedules.map((schedule) => (
                  <div className="rounded-md bg-background p-3 text-sm" key={schedule.id}>
                    <p className="font-semibold">
                      {schedule.date} · {schedule.startTime}
                    </p>
                    <p className="text-muted">
                      Мест: {schedule.capacity - schedule.bookedSeats} из {schedule.capacity} ·{" "}
                      {schedule.status}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">Расписание уточняется.</p>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-5">
          <SectionTitle title="Похожие туры" description="Другие предложения из mock-каталога." />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {similarTours.map((item) => (
              <TourCard key={item.id} tour={item} />
            ))}
          </div>
        </section>
      </Container>
      <PublicFooter />
    </main>
  );
}

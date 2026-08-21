import { RealStayBookingPanel } from "@/components/booking/RealStayBookingPanel";
import { StayBookingPanel } from "@/components/booking/StayBookingPanel";
import { EmptyState } from "@/components/catalog/EmptyState";
import { StayCard } from "@/components/cards/StayCard";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getPublicStayDetailReadResult } from "@/lib/data/public-booking-detail-read";

type StayDetailPageProps = {
  params: Promise<{ slug: string }>;
};

const stayTypeLabels = {
  guest_house: "Гостевой дом",
  hotel: "Отель",
  cottage: "Коттедж",
  yurt_camp: "Юрточный лагерь",
  villa: "Вилла"
};

export default async function StayDetailPage({ params }: StayDetailPageProps) {
  const { slug } = await params;
  const result = await getPublicStayDetailReadResult(slug);
  const stay = result.stay;

  if (!result.ok || !stay) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <PublicHeader />
        <Container className="py-10">
          <EmptyState
            actionLabel="Вернуться к жилью"
            description="Объект не найден или сейчас недоступен для бронирования."
            href="/stays"
            title="Жильё не найдено"
          />
        </Container>
        <PublicFooter />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="space-y-10 py-10">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge>{stay.location}</Badge>
              <Badge variant="info">{stayTypeLabels[stay.type]}</Badge>
              <Badge variant="success">★ {stay.rating}</Badge>
            </div>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">{stay.title}</h1>
            <p className="text-lg leading-8 text-muted">{stay.description}</p>
            <div className="flex flex-wrap items-center gap-4">
              <p className="text-3xl font-semibold">
                от {stay.minPricePerNight} {stay.currency} / ночь
              </p>
              <Button>Выбрать номер</Button>
            </div>
          </div>
          <div className="aspect-[4/3] rounded-lg bg-gradient-to-br from-secondary via-primary to-[#d7b56d] p-5 text-white">
            <div className="flex h-full flex-col justify-between">
              <Badge className="border-white/40 bg-white text-secondary">{stay.status}</Badge>
              <p className="text-2xl font-semibold">Отдых у Иссык-Куля</p>
            </div>
          </div>
        </section>

        {result.source === "mock" ? (
          <StayBookingPanel rooms={result.rooms} stay={stay} />
        ) : result.inventoryOk && result.rooms.length > 0 ? (
          <RealStayBookingPanel rooms={result.rooms} stay={stay} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Онлайн-бронирование</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted">
              <p>Свободные номера сейчас уточняются. Мы не показываем неподтверждённую доступность.</p>
            </CardContent>
          </Card>
        )}

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Календарь доступности</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              {result.availability.length > 0 ? (
                result.availability.slice(0, 6).map((item) => (
                  <div className="rounded-md bg-background p-3" key={item.id}>
                    <p className="font-semibold">{item.date}</p>
                    <p className="text-muted">{item.status}</p>
                  </div>
                ))
              ) : (
                <p className="col-span-full text-muted">Доступные даты уточняются.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Актуальная стоимость</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted">
              <p>Финальная стоимость рассчитывается по выбранному номеру и датам.</p>
              <p>Перед подтверждением система повторно проверяет свободные места и цену.</p>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-5">
          <SectionTitle title="Номера" description="Варианты размещения, вместимость и базовая стоимость." />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {result.rooms.length > 0 ? (
              result.rooms.map((room) => (
                <Card key={room.id}>
                  <CardHeader>
                    <CardTitle>{room.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted">
                    <p>Вместимость: до {room.capacity} гостей</p>
                    <p>Цена: {room.pricePerNight} {room.currency} / ночь</p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <EmptyState
                actionLabel="Вернуться к жилью"
                description="Для объекта пока нет доступных вариантов размещения."
                href="/stays"
                title="Номера уточняются"
              />
            )}
          </div>
        </section>

        <section className="space-y-5">
          <SectionTitle title="Похожие варианты жилья" description="Другие предложения для отдыха на Иссык-Куле." />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {result.similarStays.map((item) => (
              <StayCard key={item.id} stay={item} />
            ))}
          </div>
        </section>
      </Container>
      <PublicFooter />
    </main>
  );
}

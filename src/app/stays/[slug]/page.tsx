import { EmptyState } from "@/components/catalog/EmptyState";
import { StayBookingPanel } from "@/components/booking/StayBookingPanel";
import { StayCard } from "@/components/cards/StayCard";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getRoomAvailability, getRooms, getStayById, getStays } from "@/lib/data/catalog";

type StayDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

const stayTypeLabels = {
  guest_house: "Гостевой дом",
  hotel: "Отель",
  cottage: "Коттедж",
  yurt_camp: "Юрточный лагерь",
  villa: "Вилла"
};

export function generateStaticParams() {
  return getStays().map((stay) => ({ slug: stay.slug }));
}

export default async function StayDetailPage({ params }: StayDetailPageProps) {
  const { slug } = await params;
  const stay = getStayById(slug);

  if (!stay) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <PublicHeader />
        <Container className="py-10">
          <EmptyState
            actionLabel="Вернуться к жилью"
            description="Такого объекта жилья нет в mock-каталоге или ссылка устарела."
            href="/stays"
            title="Жильё не найдено"
          />
        </Container>
        <PublicFooter />
      </main>
    );
  }

  const allRooms = getRooms();
  const roomAvailability = getRoomAvailability();
  const rooms = allRooms.filter((room) => room.stayId === stay.id);
  const similarStays = getStays().filter((item) => item.id !== stay.id).slice(0, 3);

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
              <p className="text-2xl font-semibold">Жильё у Иссык-Куля</p>
            </div>
          </div>
        </section>

        <StayBookingPanel rooms={rooms} stay={stay} />

        <section className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Удобства</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted">
              <p>Wi-Fi</p>
              <p>Парковка</p>
              <p>Зона отдыха</p>
              <p>Помощь с турами</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Заезд / выезд</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted">
              <p>Заезд: после 14:00</p>
              <p>Выезд: до 12:00</p>
              <p>Ранний заезд по согласованию.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Календарь доступности</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2 text-sm">
              {roomAvailability.slice(0, 3).map((item) => (
                <div className="rounded-md bg-background p-3" key={item.id}>
                  <p className="font-semibold">{item.date}</p>
                  <p className="text-muted">{item.status}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-5">
          <SectionTitle title="Номера" description="Mock номера для будущего booking flow." />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rooms.length > 0 ? (
              rooms.map((room) => (
                <Card key={room.id}>
                  <CardHeader>
                    <CardTitle>{room.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted">
                    <p>Вместимость: до {room.capacity} гостей</p>
                    <p>
                      Цена: {room.pricePerNight} {room.currency} / ночь
                    </p>
                    <Button className="w-full">Выбрать номер</Button>
                  </CardContent>
                </Card>
              ))
            ) : (
              <EmptyState
                actionLabel="Уточнить доступность"
                description="Для этого объекта пока нет mock-номеров."
                title="Номера уточняются"
              />
            )}
          </div>
        </section>

        <section className="space-y-5">
          <SectionTitle title="Похожие варианты жилья" description="Другие объекты из mock-каталога." />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {similarStays.map((item, index) => (
              <StayCard key={item.id} room={allRooms[index]} stay={item} />
            ))}
          </div>
        </section>
      </Container>
      <PublicFooter />
    </main>
  );
}

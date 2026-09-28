import Image from "next/image";
import { RealStayBookingPanel } from "@/components/booking/RealStayBookingPanel";
import { StayBookingPanel } from "@/components/booking/StayBookingPanel";
import { EmptyState } from "@/components/catalog/EmptyState";
import { StayCard } from "@/components/cards/StayCard";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getPublicStayDetailReadResult } from "@/lib/data/public-booking-detail-read";
import { stayGallery, stayImage, stayLogo } from "@/lib/presentation-media";
import { getHotelPublicContent } from "@/lib/hotel-content";

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
  const hotelContent = stay ? getHotelPublicContent(stay.slug) : undefined;
  const gallery = stay ? stayGallery(stay) : [];

  if (!result.ok || !stay) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <PublicHeader />
        <Container className="py-10">
          <EmptyState actionLabel="Вернуться к жилью" description="Объект не найден или сейчас недоступен для бронирования." href="/stays" title="Жильё не найдено" />
        </Container>
        <PublicFooter />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="space-y-10 py-10">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge>{stay.location}</Badge>
              <Badge variant="info">{stayTypeLabels[stay.type]}</Badge>
              <Badge variant="success">★ {stay.rating}</Badge>
            </div>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">{stay.title}</h1>
            <p className="text-lg leading-8 text-muted">{stay.description}</p>
            <div className="flex flex-wrap items-center gap-4">
              <p className="text-3xl font-semibold">{stay.minPricePerNight > 0 ? `от ${stay.minPricePerNight.toLocaleString("ru-RU")} ${stay.currency} / ночь` : "Цена по запросу"}</p>
              <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-primary bg-primary px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90" href="#booking">Выбрать номер</a>
            </div>
          </div>
          <div
            className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-cover bg-center shadow-soft"
            style={{ backgroundImage: `url("${stayImage(stay)}")` }}
          >
            {stayLogo(stay) ? <Image alt={`${stay.title} — логотип`} className="absolute right-4 top-4 h-16 w-24 rounded-xl bg-white/95 object-contain p-2 shadow-lg" height={128} src={stayLogo(stay)} width={192} /> : null}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5 text-white">
              <p className="text-2xl font-semibold">Отдых у Иссык-Куля</p>
              <Badge className="border-white/40 bg-white text-secondary">{stay.status}</Badge>
            </div>
          </div>
        </section>

        <section className="space-y-5" aria-label={`Фотографии объекта ${stay.title}`}>
          <SectionTitle title="Фотографии объекта" description="Реальные материалы из контент-пакета отеля." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {gallery.map((image, index) => (
              <div
                aria-label={`${stay.title}, фото ${index + 1}`}
                className={index === 0 ? "relative aspect-[16/10] overflow-hidden rounded-2xl bg-cover bg-center sm:col-span-2 sm:row-span-2" : "relative aspect-[4/3] overflow-hidden rounded-2xl bg-cover bg-center"}
                key={image}
                role="img"
                style={{ backgroundImage: `url("${image}")` }}
              />
            ))}
          </div>
        </section>

        {hotelContent ? (
          <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader><CardTitle>Главное об объекте</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {hotelContent.highlights.map((item) => <Badge key={item} variant="info">{item}</Badge>)}
                </div>
                {hotelContent.priceNote ? <p className="mt-5 text-sm leading-6 text-muted">{hotelContent.priceNote}</p> : null}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Условия проживания</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {hotelContent.rules.map((rule) => <div className="flex items-start justify-between gap-4 border-b border-border/70 pb-2 last:border-0" key={rule.label}><span className="text-muted">{rule.label}</span><strong className="text-right">{rule.value}</strong></div>)}
              </CardContent>
            </Card>
            {hotelContent.extras?.length ? (
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle>Дополнительные услуги и условия</CardTitle></CardHeader>
                <CardContent className="grid gap-2 text-sm text-muted sm:grid-cols-2 lg:grid-cols-3">
                  {hotelContent.extras.map((item) => <div className="rounded-xl bg-background p-3" key={item}>{item}</div>)}
                </CardContent>
              </Card>
            ) : null}
          </section>
        ) : null}

        <section className="scroll-mt-28" id="booking">
          {result.source === "mock" ? (
            <StayBookingPanel rooms={result.rooms} stay={stay} />
          ) : result.inventoryOk && result.rooms.length > 0 ? (
            <RealStayBookingPanel rooms={result.rooms} stay={stay} />
          ) : (
            <Card>
              <CardHeader><CardTitle>Онлайн-бронирование</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted"><p>Свободные номера сейчас уточняются. Мы не показываем неподтверждённую доступность.</p></CardContent>
            </Card>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Календарь доступности</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              {result.availability.length > 0 ? result.availability.slice(0, 6).map((item) => (
                <div className="rounded-md bg-background p-3" key={item.id}><p className="font-semibold">{item.date}</p><p className="text-muted">{item.status}</p></div>
              )) : <p className="col-span-full text-muted">Доступные даты уточняются.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Актуальная стоимость</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-muted">
              <p>Финальная стоимость рассчитывается по выбранному номеру и датам.</p>
              <p>Перед подтверждением система повторно проверяет свободные места и цену.</p>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-5">
          <SectionTitle title="Номера" description="Варианты размещения, вместимость и базовая стоимость." />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {result.rooms.length > 0 ? result.rooms.map((room) => (
              <Card key={room.id}><CardHeader><CardTitle>{room.title}</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted"><p>Вместимость: до {room.capacity} гостей</p><p>{room.pricePerNight > 0 ? `Цена: ${room.pricePerNight.toLocaleString("ru-RU")} ${room.currency} / ночь` : "Цена по запросу"}</p></CardContent></Card>
            )) : <EmptyState actionLabel="Вернуться к жилью" description="Для объекта пока нет доступных вариантов размещения." href="/stays" title="Номера уточняются" />}
          </div>
        </section>

        <section className="space-y-5">
          <SectionTitle title="Похожие варианты жилья" description="Другие предложения для отдыха на Иссык-Куле." />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{result.similarStays.map((item) => <StayCard key={item.id} stay={item} />)}</div>
        </section>
      </Container>
      <PublicFooter />
    </main>
  );
}

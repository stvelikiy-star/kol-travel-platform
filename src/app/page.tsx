import Link from "next/link";
import { FoodCard } from "@/components/cards/FoodCard";
import { PartnerCard } from "@/components/cards/PartnerCard";
import { ProductCard } from "@/components/cards/ProductCard";
import { StayCard } from "@/components/cards/StayCard";
import { TourCard } from "@/components/cards/TourCard";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Input } from "@/components/ui/Input";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Select } from "@/components/ui/Select";
import { getFood, getProducts, getRooms, getStays, getTours } from "@/lib/data/catalog";
import { getPartners } from "@/lib/data/partners";

const tours = getTours();
const stays = getStays();
const foodItems = getFood();
const products = getProducts();
const partners = getPartners();
const rooms = getRooms();

const categories = [
  { title: "Туры", href: "/tours", description: "Катера, джип-туры, этно-маршруты и экскурсии.", badge: `${tours.length} предложений` },
  { title: "Жильё", href: "/stays", description: "Отели, гостевые дома, коттеджи, юрты и виллы.", badge: `${stays.length} объектов` },
  { title: "Еда", href: "/food", description: "Рестораны, кафе и блюда для отдыха на Иссык-Куле.", badge: `${foodItems.length} блюд` },
  { title: "Магазин", href: "/shop", description: "Продукты, пляжные товары и локальные покупки.", badge: `${products.length} товаров` },
  { title: "Личный кабинет", href: "/client", description: "Заказы, бронирования, избранное и поддержка.", badge: "1 аккаунт" },
  { title: "Партнёрам", href: "/partner", description: "Заказы, брони, каталог, доступность и управление бизнесом.", badge: `${partners.length} партнёров` }
];

const steps = [
  "Выберите тур, жильё, еду или товары",
  "Проверьте предложение и доступность",
  "Оформите заказ или бронирование",
  "Следите за статусом в одном аккаунте"
];

function getPartnerName(businessId: string) {
  return partners.find((partner) => partner.id === businessId)?.title ?? "KÖL Partner";
}

function getPartnerSlug(businessId: string) {
  return partners.find((partner) => partner.id === businessId)?.slug;
}

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />

      <section className="relative overflow-hidden border-b border-border/80 bg-gradient-to-br from-surface via-lake-light to-sand-light">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-white/55" />
        <Container className="relative grid min-h-[620px] gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-7">
            <div className="flex flex-wrap gap-2">
              <Badge>Иссык-Куль</Badge>
              <Badge variant="info">KÖL Ecosystem</Badge>
              <Badge variant="success">Бронирование · Заказы · Доставка</Badge>
            </div>
            <div className="space-y-5">
              <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
                Весь Иссык-Куль в одной платформе
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted">
                Жильё, туры, еда и локальные покупки — единый сервис для отдыха, единый аккаунт и единая операционная система.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <HeroLink href="/stays" label="Найти жильё" primary />
              <HeroLink href="/tours" label="Смотреть туры" />
              <HeroLink href="/presentation" label="Обзор платформы" subtle />
            </div>
          </div>

          <div className="rounded-lg border border-white/70 bg-surface/70 p-4 shadow-soft backdrop-blur">
            <div className="aspect-[4/3] rounded-md bg-gradient-to-br from-lake-dark via-primary to-sand p-5 text-white shadow-card">
              <div className="flex h-full flex-col justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide">KÖL · Issyk-Kul</p>
                  <h2 className="mt-3 text-3xl font-semibold leading-tight">
                    Чолпон-Ата, Бостери, Каракол и весь берег в одном сервисе
                  </h2>
                </div>
                <div className="grid gap-3 rounded-md bg-white/95 p-4 text-foreground shadow-sm sm:grid-cols-3">
                  <Metric value={tours.length} label="туров" />
                  <Metric value={stays.length} label="объектов жилья" />
                  <Metric value={partners.length} label="партнёров" />
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <Container className="space-y-16 py-12">
        <section className="relative z-0 -mt-6 rounded-lg border border-border/90 bg-surface/95 p-4 shadow-soft backdrop-blur lg:p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_0.8fr_0.9fr_auto]">
            <Input placeholder="Куда едем?" />
            <Input aria-label="Даты поездки" type="date" />
            <Input min={1} placeholder="Гости" type="number" />
            <Select defaultValue="all">
              <option value="all">Все категории</option>
              <option value="tours">Туры</option>
              <option value="stays">Жильё</option>
              <option value="food">Еда</option>
              <option value="shop">Магазин</option>
            </Select>
            <Button className="w-full xl:w-auto">Найти</Button>
          </div>
        </section>

        <section className="space-y-6">
          <SectionTitle
            description="Быстрый вход в основные сценарии отдыха и кабинеты экосистемы."
            eyebrow="KÖL"
            title="Всё необходимое в одном месте"
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <Link className="group block" href={category.href} key={category.title}>
                <Card className="h-full transition duration-200 group-hover:-translate-y-1 group-hover:border-primary group-hover:shadow-soft">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-xl font-semibold">{category.title}</h3>
                      <Badge variant="muted">{category.badge}</Badge>
                    </div>
                    <p className="text-sm leading-6 text-muted">{category.description}</p>
                    <span className="text-sm font-semibold text-primary">Открыть →</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <SectionTitle description="Активности, маршруты и локальные впечатления." eyebrow="KÖL Tours" title="Популярные туры" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tours.slice(0, 3).map((tour) => <TourCard key={tour.id} tour={tour} />)}
          </div>
          <TextLink href="/tours" label="Смотреть все туры" />
        </section>

        <section className="space-y-6">
          <SectionTitle description="Гостевые дома, отели, коттеджи, юрточные лагеря и виллы." eyebrow="KÖL Stay" title="Жильё на Иссык-Куле" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {stays.slice(0, 3).map((stay, index) => <StayCard key={stay.id} room={rooms[index]} stay={stay} />)}
          </div>
          <TextLink href="/stays" label="Смотреть всё жильё" />
        </section>

        <section className="space-y-6">
          <SectionTitle description="Рестораны, кафе и локальная кухня." eyebrow="KÖL Food" title="Еда рядом" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {foodItems.slice(0, 3).map((food) => (
              <FoodCard food={food} key={food.id} partnerName={getPartnerName(food.businessId)} partnerSlug={getPartnerSlug(food.businessId)} />
            ))}
          </div>
          <TextLink href="/food" label="Открыть KÖL Food" />
        </section>

        <section className="space-y-6">
          <SectionTitle description="Товары для поездки и отдыха от локальных партнёров." eyebrow="KÖL Shop" title="Магазин для отдыха" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {products.slice(0, 3).map((product) => (
              <ProductCard key={product.id} partnerName={getPartnerName(product.businessId)} partnerSlug={getPartnerSlug(product.businessId)} product={product} />
            ))}
          </div>
          <TextLink href="/shop" label="Открыть KÖL Shop" />
        </section>

        <section className="space-y-6">
          <SectionTitle description="Отели, рестораны, магазины, туроператоры и гиды в единой операционной системе." eyebrow="KÖL Partner" title="Партнёры платформы" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {partners.slice(0, 3).map((partner) => <PartnerCard key={partner.id} partner={partner} />)}
          </div>
        </section>

        <section className="space-y-6">
          <SectionTitle description="Путь пользователя остаётся коротким, даже когда за сценой работает полноценный marketplace." eyebrow="Как это работает" title="Один понятный сценарий" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <Card key={step}>
                <CardContent className="space-y-4 p-5">
                  <Badge>{index + 1}</Badge>
                  <p className="text-base font-semibold leading-7">{step}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-6 rounded-lg border border-border bg-surface p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="space-y-3">
            <Badge variant="info">Для партнёров</Badge>
            <h2 className="text-3xl font-semibold leading-tight">Управляйте продажами и бронированиями через KÖL</h2>
            <p className="max-w-3xl text-base leading-7 text-muted">
              Подключайте жильё, ресторан, магазин или туры и управляйте операциями через единый партнёрский кабинет.
            </p>
          </div>
          <HeroLink href="/partner" label="Открыть кабинет партнёра" primary />
        </section>

        <section className="rounded-lg bg-gradient-to-br from-primary via-secondary to-accent p-6 text-white lg:p-10">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="max-w-2xl text-3xl font-semibold leading-tight">Иссык-Куль начинается с KÖL</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">Выберите жильё, тур, еду или товары и управляйте поездкой из одного аккаунта.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <HeroLink href="/tours" label="Смотреть туры" light />
              <HeroLink href="/stays" label="Найти жильё" />
            </div>
          </div>
        </section>
      </Container>

      <PublicFooter />
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function TextLink({ href, label }: { href: string; label: string }) {
  return <Link className="inline-block text-sm font-semibold text-primary hover:underline" href={href}>{label} →</Link>;
}

function HeroLink({ href, label, light = false, primary = false, subtle = false }: { href: string; label: string; light?: boolean; primary?: boolean; subtle?: boolean }) {
  const className = light
    ? "inline-flex min-h-11 items-center justify-center rounded-md border border-white bg-white px-5 py-2 text-sm font-semibold text-primary shadow-sm transition hover:opacity-90"
    : primary
      ? "inline-flex min-h-11 items-center justify-center rounded-md border border-primary bg-primary px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
      : subtle
        ? "inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-5 py-2 text-sm font-semibold text-muted shadow-sm transition hover:border-primary hover:text-primary"
        : "inline-flex min-h-11 items-center justify-center rounded-md border border-white/60 bg-transparent px-5 py-2 text-sm font-semibold text-white transition hover:bg-white hover:text-primary";

  return <Link className={className} href={href}>{label}</Link>;
}

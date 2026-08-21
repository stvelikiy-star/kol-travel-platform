import Link from "next/link";
import { FoodCard } from "@/components/cards/FoodCard";
import { PartnerCard } from "@/components/cards/PartnerCard";
import { ProductCard } from "@/components/cards/ProductCard";
import { StayCard } from "@/components/cards/StayCard";
import { TourCard } from "@/components/cards/TourCard";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Input } from "@/components/ui/Input";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Select } from "@/components/ui/Select";
import { getFood, getProducts, getRooms, getStays, getTours } from "@/lib/data/catalog";
import { getPartners } from "@/lib/data/partners";
import { presentationMedia } from "@/lib/presentation-media";

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
  { title: "Собственник", href: "/owner", description: "Сводка бизнеса и быстрый вход во все операционные кабинеты.", badge: "Owner" },
  { title: "Партнёр", href: "/partner", description: "Заказы, брони, каталог, доступность и управление бизнесом.", badge: `${partners.length} партнёров` },
  { title: "Курьер", href: "/courier", description: "Доставки, активный маршрут, история и проблемы.", badge: "Delivery" },
  { title: "Администратор", href: "/admin", description: "Единый операционный центр, риски, финансы и модерация.", badge: "Admin" }
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

      <section className="relative overflow-hidden border-b border-cyan-100 bg-slate-950 text-white">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-75"
          style={{ backgroundImage: `url("${presentationMedia.lake}")` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-cyan-950/35" />
        <div className="absolute -right-24 top-12 h-72 w-72 rounded-full bg-cyan-300/25 blur-3xl" />
        <Container className="relative grid min-h-[690px] gap-10 py-14 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div className="space-y-7">
            <div className="flex flex-wrap gap-2">
              <Badge className="border-white/20 bg-white text-slate-950">Иссык-Куль · Ысык-Көл</Badge>
              <Badge className="border-cyan-300/30 bg-cyan-300/15 text-cyan-100">KÖL Ecosystem</Badge>
              <Badge className="border-amber-300/30 bg-amber-300 text-slate-950">Бронирование · Заказы · Доставка</Badge>
            </div>
            <div className="space-y-5">
              <h1 className="max-w-4xl text-5xl font-semibold leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl">
                Весь Иссык-Куль в одной платформе
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-cyan-50/85">
                Жильё, туры, еда и локальные покупки — единый сервис для отдыха, единый аккаунт и единая операционная система.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <HeroLink href="/stays" label="Найти жильё" light />
              <HeroLink href="/tours" label="Смотреть туры" />
              <HeroLink href="/owner" label="Кабинет собственника" amber />
            </div>
            <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
              <HeroMetric label="туров" value={tours.length} />
              <HeroMetric label="объектов жилья" value={stays.length} />
              <HeroMetric label="партнёров" value={partners.length} />
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/20 bg-white/10 p-4 shadow-2xl backdrop-blur-md">
            <div
              className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-cover bg-center shadow-2xl"
              style={{ backgroundImage: `url("${presentationMedia.coast}")` }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">KÖL · Issyk-Kul</p>
                <h2 className="mt-2 text-3xl font-semibold leading-tight">Чолпон-Ата, Бостери, Каракол и весь берег в одном сервисе</h2>
                <p className="mt-3 text-sm leading-6 text-white/75">Клиентская витрина + собственник + партнёр + курьер + администратор.</p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <Container className="space-y-16 py-12">
        <section className="relative z-0 -mt-8 rounded-2xl border border-border/90 bg-surface/95 p-4 shadow-soft backdrop-blur lg:p-5">
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
            <Link className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 xl:w-auto" href="/stays">
              Открыть каталог
            </Link>
          </div>
        </section>

        <section className="space-y-6">
          <SectionTitle description="Быстрый вход в основные сценарии отдыха и рабочие кабинеты экосистемы." eyebrow="KÖL" title="Вся платформа перед вами" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <Link className="group block" href={category.href} key={category.title}>
                <Card className="h-full overflow-hidden transition duration-200 group-hover:-translate-y-1 group-hover:border-primary group-hover:shadow-soft">
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

        <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-cyan-950 via-primary to-blue-700 p-7 text-white shadow-2xl lg:p-10">
          <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <Badge className="border-white/20 bg-white text-primary">Рабочие кабинеты KÖL</Badge>
              <h2 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">Покажите полный цикл: собственник → партнёр → курьер → администратор</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/80">Все роли доступны в реальном интерфейсе платформы и связаны общей навигацией RU/KG.</p>
            </div>
            <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
              <HeroLink href="/owner" label="Собственник" amber />
              <HeroLink href="/partner" label="Партнёр" />
              <HeroLink href="/courier" label="Курьер" />
              <HeroLink href="/admin" label="Администратор" />
            </div>
          </div>
        </section>
      </Container>

      <PublicFooter />
    </main>
  );
}

function HeroMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur">
      <p className="text-3xl font-semibold text-amber-300">{value}</p>
      <p className="mt-1 text-xs font-medium text-cyan-50/75">{label}</p>
    </div>
  );
}

function TextLink({ href, label }: { href: string; label: string }) {
  return <Link className="inline-block text-sm font-semibold text-primary hover:underline" href={href}>{label} →</Link>;
}

function HeroLink({ href, label, light = false, amber = false }: { href: string; label: string; light?: boolean; amber?: boolean }) {
  const className = light
    ? "inline-flex min-h-11 items-center justify-center rounded-xl border border-white bg-white px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-cyan-50"
    : amber
      ? "inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-300 bg-amber-300 px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-amber-200"
      : "inline-flex min-h-11 items-center justify-center rounded-xl border border-white/50 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white hover:text-primary";

  return <Link className={className} href={href}>{label}</Link>;
}

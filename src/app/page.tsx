import Link from "next/link";
import { FoodCard } from "@/components/cards/FoodCard";
import { ProductCard } from "@/components/cards/ProductCard";
import { StayCard } from "@/components/cards/StayCard";
import { TourCard } from "@/components/cards/TourCard";
import { HomeSearchBar } from "@/components/home/HomeSearchBar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Badge } from "@/components/ui/Badge";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
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
  { title: "Жильё", href: "/stays", image: presentationMedia.coast, meta: `${stays.length} вариантов` },
  { title: "Туры", href: "/tours", image: presentationMedia.canyon, meta: `${tours.length} впечатлений` },
  { title: "Еда", href: "/food", image: presentationMedia.beshbarmak, meta: `${foodItems.length} блюд` },
  { title: "Магазин", href: "/shop", image: presentationMedia.bazaar, meta: `${products.length} товаров` }
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
          className="absolute inset-0 bg-cover bg-center opacity-80"
          style={{ backgroundImage: `url("${presentationMedia.lake}")` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/72 to-cyan-950/20" />
        <Container className="relative grid min-h-[500px] gap-9 py-12 lg:min-h-[610px] lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-16">
          <div className="space-y-6">
            <Badge className="w-fit border-white/20 bg-white text-slate-950">Иссык-Куль · Ысык-Көл</Badge>
            <div className="space-y-4">
              <h1 className="max-w-4xl text-5xl font-semibold leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl">
                Всё для отдыха на Иссык-Куле
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-white/80">
                Найдите жильё, выберите впечатления, закажите еду и всё необходимое для поездки в одном удобном сервисе.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <HeroLink href="/stays" label="Найти жильё" light />
              <HeroLink href="/tours" label="Смотреть туры" />
            </div>
          </div>

          <div className="hidden overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 p-3 shadow-2xl backdrop-blur-md lg:block">
            <div
              className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-cover bg-center"
              style={{ backgroundImage: `url("${presentationMedia.coast}")` }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/78 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">KÖL · Issyk-Kul</p>
                <h2 className="mt-2 max-w-lg text-2xl font-semibold leading-tight sm:text-3xl">
                  Чолпон-Ата, Бостери, Каракол и весь берег
                </h2>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <Container className="space-y-14 py-10 lg:space-y-16 lg:py-12">
        <section className="relative z-10 -mt-14 rounded-2xl border border-border/90 bg-surface/95 p-4 shadow-soft backdrop-blur lg:p-5">
          <HomeSearchBar />
        </section>

        <section className="space-y-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Отдых на Иссык-Куле</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Что вы ищете?</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {categories.map((category) => (
              <Link
                className="group relative min-h-36 overflow-hidden rounded-2xl border border-border/70 bg-slate-900 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-soft sm:min-h-44 lg:min-h-48"
                href={category.href}
                key={category.href}
              >
                <div className="absolute inset-0 bg-cover bg-center transition duration-300 group-hover:scale-105" style={{ backgroundImage: `url("${category.image}")` }} />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/88 via-slate-950/25 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-5">
                  <h3 className="text-xl font-semibold sm:text-2xl">{category.title}</h3>
                  <p className="mt-1 text-xs text-white/75 sm:text-sm">{category.meta}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <SectionTitle
            description="Отели, гостевые дома, коттеджи и другие варианты для отдыха у озера."
            eyebrow="Жильё"
            title="Где остановиться"
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {stays.slice(0, 3).map((stay, index) => <StayCard key={stay.id} room={rooms[index]} stay={stay} />)}
          </div>
          <TextLink href="/stays" label="Смотреть всё жильё" />
        </section>

        <section className="space-y-6">
          <SectionTitle
            description="Маршруты и впечатления, которые можно добавить к поездке."
            eyebrow="Туры"
            title="Чем заняться"
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tours.slice(0, 3).map((tour) => <TourCard key={tour.id} tour={tour} />)}
          </div>
          <TextLink href="/tours" label="Смотреть все туры" />
        </section>

        <section className="grid gap-12 lg:grid-cols-2 lg:gap-8">
          <div className="space-y-6">
            <SectionTitle description="Рестораны, кафе и локальная кухня рядом с вами." eyebrow="Еда" title="Что поесть" />
            <div className="grid gap-4">
              {foodItems.slice(0, 2).map((food) => (
                <FoodCard food={food} key={food.id} partnerName={getPartnerName(food.businessId)} partnerSlug={getPartnerSlug(food.businessId)} />
              ))}
            </div>
            <TextLink href="/food" label="Смотреть всю еду" />
          </div>

          <div className="space-y-6">
            <SectionTitle description="Полезные вещи, продукты и локальные товары для поездки." eyebrow="Магазин" title="Что купить" />
            <div className="grid gap-4">
              {products.slice(0, 2).map((product) => (
                <ProductCard key={product.id} partnerName={getPartnerName(product.businessId)} partnerSlug={getPartnerSlug(product.businessId)} product={product} />
              ))}
            </div>
            <TextLink href="/shop" label="Открыть магазин" />
          </div>
        </section>
      </Container>

      <PublicFooter />
    </main>
  );
}

function TextLink({ href, label }: { href: string; label: string }) {
  return <Link className="inline-flex min-h-10 items-center text-sm font-semibold text-primary hover:underline" href={href}>{label} →</Link>;
}

function HeroLink({ href, label, light = false }: { href: string; label: string; light?: boolean }) {
  const className = light
    ? "inline-flex min-h-11 items-center justify-center rounded-xl border border-white bg-white px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-cyan-50"
    : "inline-flex min-h-11 items-center justify-center rounded-xl border border-white/30 bg-white/10 px-5 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20";

  return <Link className={className} href={href}>{label}</Link>;
}

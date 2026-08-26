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
import { getPublicFoodReadResult } from "@/lib/data/public-catalog-read";
import { getPublicPartnersReadResult } from "@/lib/data/public-partners-read";
import { getPublicShopReadResult } from "@/lib/data/public-shop-read";
import { getPublicStaysReadResult } from "@/lib/data/public-stays-read";
import { getPublicToursReadResult } from "@/lib/data/public-tours-read";
import { presentationMedia } from "@/lib/presentation-media";

const trustPoints = [
  "Жильё, туры и покупки в одном месте",
  "Понятный путь от выбора до оформления",
  "Русский и кыргызский интерфейс"
];

export default async function Home() {
  const [staysResult, toursResult, foodResult, shopResult, partnersResult] = await Promise.all([
    getPublicStaysReadResult(),
    getPublicToursReadResult(),
    getPublicFoodReadResult(),
    getPublicShopReadResult(),
    getPublicPartnersReadResult()
  ]);
  const stays = staysResult.items;
  const tours = toursResult.items;
  const foodItems = foodResult.items;
  const products = shopResult.items;
  const partners = partnersResult.items;
  const categories = [
    {
      title: "Жильё",
      href: "/stays",
      image: presentationMedia.heroMountain,
      meta: `${stays.length} вариантов`,
      hook: "Просыпайтесь рядом с озером"
    },
    {
      title: "Туры",
      href: "/tours",
      image: presentationMedia.canyon,
      meta: `${tours.length} впечатлений`,
      hook: "Добавьте приключение в поездку"
    },
    {
      title: "Еда",
      href: "/food",
      image: presentationMedia.manty,
      meta: `${foodItems.length} блюд`,
      hook: "Закажите вкусное рядом"
    },
    {
      title: "Магазин",
      href: "/shop",
      image: presentationMedia.bazaar,
      meta: `${products.length} товаров`,
      hook: "Всё нужное для отдыха"
    }
  ];

  function getPartnerName(businessId: string) {
    return partners.find((partner) => partner.id === businessId)?.title ?? "KÖL Partner";
  }

  function getPartnerSlug(businessId: string) {
    return partners.find((partner) => partner.id === businessId)?.slug;
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />

      <section className="relative isolate overflow-hidden border-b border-cyan-100 bg-slate-950 text-white">
        <div
          className="kol-hero-photo absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url("${presentationMedia.heroMountain}")` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/70 to-cyan-950/15" />
        <div className="kol-orb kol-orb--cyan absolute -right-24 top-12 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="kol-orb kol-orb--amber absolute -left-20 bottom-0 h-56 w-56 rounded-full bg-amber-300/15 blur-3xl" />

        <Container className="relative grid min-h-[560px] gap-10 py-14 lg:min-h-[680px] lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:py-16">
          <div className="kol-reveal space-y-7">
            <div className="flex flex-wrap gap-2">
              <Badge className="w-fit border-white/20 bg-white text-slate-950">Иссык-Куль · Ысык-Көл</Badge>
              <Badge className="kol-pulse-chip border-cyan-200/30 bg-cyan-200/15 text-cyan-50">Отдых начинается здесь</Badge>
            </div>

            <div className="space-y-5">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">KÖL Travel</p>
              <h1 className="max-w-4xl text-5xl font-semibold leading-[0.96] tracking-tight sm:text-6xl lg:text-7xl">
                Соберите свой Иссык-Куль в одном месте
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-white/82 sm:text-xl">
                Жильё, впечатления, еда и нужные покупки — без десятков вкладок и лишней путаницы.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <HeroLink href="/stays" label="Подобрать жильё" light />
              <HeroLink href="/tours" label="Найти впечатления" />
            </div>

            <div className="grid max-w-2xl gap-2 sm:grid-cols-3">
              {trustPoints.map((point, index) => (
                <div
                  className="kol-reveal-soft rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-medium text-white/82 backdrop-blur"
                  key={point}
                  style={{ animationDelay: `${180 + index * 100}ms` }}
                >
                  <span className="mr-2 text-cyan-200">✓</span>{point}
                </div>
              ))}
            </div>
          </div>

          <div className="kol-float-card hidden lg:block">
            <div className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 p-3 shadow-2xl backdrop-blur-md">
              <div
                className="kol-card-photo relative aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-cover bg-center"
                style={{ backgroundImage: `url("${presentationMedia.travelerDock}")` }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/88 via-slate-950/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Ваш отдых · ваш маршрут</p>
                  <h2 className="mt-2 max-w-lg text-3xl font-semibold leading-tight">
                    Озеро, горы и впечатления — ближе, чем кажется
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-white/72">Начните с дат и места. Остальное соберём вокруг поездки.</p>
                </div>
              </div>
              <div className="kol-floating-note absolute -left-8 top-10 rounded-2xl border border-white/35 bg-white/92 px-4 py-3 text-slate-950 shadow-2xl backdrop-blur">
                <p className="text-xs font-semibold text-primary">Быстрый старт</p>
                <p className="mt-1 text-sm font-bold">Жильё → Тур → Отдых</p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <Container className="space-y-14 py-10 lg:space-y-20 lg:py-12">
        <section className="kol-search-lift relative z-10 -mt-16 rounded-2xl border border-border/90 bg-surface/96 p-4 shadow-soft backdrop-blur lg:p-5">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-1">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Начните с главного</p>
              <p className="mt-1 text-sm text-muted">Выберите направление — дальше KÖL поможет сузить выбор.</p>
            </div>
          </div>
          <HomeSearchBar />
        </section>

        <section className="kol-reveal-soft space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Один сервис для поездки</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Что хочется прямо сейчас?</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-muted">Выбирайте по задаче, а не по внутреннему устройству платформы.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {categories.map((category, index) => (
              <Link
                className="group kol-category-card relative min-h-44 overflow-hidden rounded-2xl border border-border/70 bg-slate-900 shadow-sm sm:min-h-52 lg:min-h-64"
                href={category.href}
                key={category.href}
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <div className="kol-category-photo absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${category.image}")` }} />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/92 via-slate-950/18 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-5">
                  <p className="mb-2 hidden text-xs font-medium text-white/70 sm:block">{category.hook}</p>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold sm:text-2xl">{category.title}</h3>
                      <p className="mt-1 text-xs text-white/70 sm:text-sm">{category.meta}</p>
                    </div>
                    <span className="kol-arrow flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/16 text-lg backdrop-blur">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="kol-story-card relative overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-2xl">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-55"
            style={{ backgroundImage: `url("${presentationMedia.yurtStair}")` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/78 to-slate-950/20" />
          <div className="relative grid min-h-[310px] gap-6 p-7 sm:p-9 lg:grid-cols-[1fr_auto] lg:items-end lg:p-12">
            <div className="max-w-3xl">
              <Badge className="border-white/20 bg-white text-slate-950">Не знаете, с чего начать?</Badge>
              <h2 className="mt-5 text-3xl font-semibold leading-tight sm:text-4xl">Сначала выберите место для отдыха. Впечатления добавятся по пути.</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75 sm:text-base">Откройте жильё, выберите подходящий район и даты, а затем добавьте туры, еду и покупки вокруг своей поездки.</p>
            </div>
            <HeroLink href="/stays" label="Начать с жилья" light />
          </div>
        </section>

        <section className="kol-reveal-soft space-y-6">
          <SectionTitle
            description="Отели, гостевые дома, коттеджи и другие варианты для отдыха у озера."
            eyebrow="Жильё"
            title="Где остановиться"
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {stays.slice(0, 3).map((stay) => <StayCard key={stay.id} stay={stay} />)}
          </div>
          <TextLink href="/stays" label="Смотреть всё жильё" />
        </section>

        <section className="kol-reveal-soft space-y-6">
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
          <div className="kol-reveal-soft space-y-6">
            <SectionTitle description="Рестораны, кафе и локальная кухня рядом с вами." eyebrow="Еда" title="Что поесть" />
            <div className="grid gap-4">
              {foodItems.slice(0, 2).map((food) => (
                <FoodCard food={food} key={food.id} partnerName={getPartnerName(food.businessId)} partnerSlug={getPartnerSlug(food.businessId)} />
              ))}
            </div>
            <TextLink href="/food" label="Смотреть всю еду" />
          </div>

          <div className="kol-reveal-soft space-y-6">
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
  return (
    <Link className="group inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary" href={href}>
      {label}<span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
    </Link>
  );
}

function HeroLink({ href, label, light = false }: { href: string; label: string; light?: boolean }) {
  const className = light
    ? "kol-cta-shimmer inline-flex min-h-12 items-center justify-center rounded-xl border border-white bg-white px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-cyan-50 hover:shadow-xl"
    : "inline-flex min-h-12 items-center justify-center rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/20";

  return <Link className={className} href={href}>{label}</Link>;
}
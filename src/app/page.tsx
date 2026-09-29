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
import { PremiumIcon } from "@/components/ui/PremiumIcon";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getPublicFoodReadResult } from "@/lib/data/public-catalog-read";
import { getPublicPartnersReadResult } from "@/lib/data/public-partners-read";
import { getPublicShopReadResult } from "@/lib/data/public-shop-read";
import { getPublicStaysReadResult } from "@/lib/data/public-stays-read";
import { getPublicToursReadResult } from "@/lib/data/public-tours-read";
import { getKOLSeason, getKOLSeasonalHero, presentationMedia } from "@/lib/presentation-media";

const trustPoints = [
  "Проживание, отдых и доставка в одном месте",
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
  const currentSeason = getKOLSeason();
  const seasonalHero = getKOLSeasonalHero();
  const categories = [
    {
      title: "Проживание",
      href: "/stays",
      image: presentationMedia.kolStays,
      meta: `${stays.length} вариантов`,
      hook: "Просыпайтесь рядом с озером"
    },
    {
      title: "Туры и отдых",
      href: "/tours",
      image: presentationMedia.kolTours,
      meta: `${tours.length} впечатлений`,
      hook: "Добавьте приключение в поездку"
    },
    {
      title: "Еда",
      href: "/food",
      image: presentationMedia.kolFood,
      meta: `${foodItems.length} предложений`,
      hook: "Рестораны, кафе и локальная кухня"
    },
    {
      title: "Магазин",
      href: "/shop",
      image: presentationMedia.kolShop,
      meta: `${products.length} товаров`,
      hook: "Продукты, сувениры и всё необходимое"
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

      <section className="kol-home-hero relative isolate overflow-hidden border-b border-cyan-100 bg-slate-950 text-white">
        <div
          className="kol-home-hero__photo absolute inset-0"
          data-season={currentSeason}
        >
          <picture>
            <source media="(max-width: 639px)" srcSet={seasonalHero.mobile} />
            <source media="(max-width: 1023px)" srcSet={seasonalHero.tablet} />
            <img alt={`Иссык-Куль, сезон ${currentSeason}`} className="h-full w-full object-cover object-center" src={seasonalHero.desktop} />
          </picture>
        </div>
        <div className="kol-home-hero__shade absolute inset-0" />

        <Container className="relative grid min-h-[620px] gap-8 py-12 lg:min-h-[690px] lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-16">
          <div className="kol-reveal max-w-4xl space-y-7">
            <div className="flex flex-wrap gap-3">
              <Badge className="w-fit border-white/20 bg-white text-slate-950">КЫРГЫЗСТАН · ИССЫК-КУЛЬ</Badge>
              <Badge className="kol-pulse-chip border-cyan-300/45 bg-cyan-400/10 text-cyan-100">Путешествуйте легко</Badge>
            </div>

            <div className="space-y-5">
              <p className="text-sm font-semibold uppercase tracking-[0.42em] text-cyan-100">К Ё Л &nbsp; T R A V E L</p>
              <h1 className="max-w-4xl text-5xl font-bold leading-[0.96] tracking-tight sm:text-6xl lg:text-[5.25rem]">
                Соберите свой <span className="text-cyan-200">Иссык-Куль</span><br className="hidden sm:block" /> в одном месте
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-white/86 sm:text-xl">
                Жильё, впечатления, еда и нужные покупки — без десятков вкладок и лишней путаницы.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <HeroLink href="/stays" label="Подобрать поездку  ›" light />
              <HeroLink href="/tours" label="Найти впечатления" />
            </div>

            <div className="grid max-w-3xl gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["home", "Жильё, туры и покупки в одном месте"],
                ["map_pin", "Понятный путь от выбора до оформления"],
                ["shield", "Русский и кыргызский интерфейс"],
                ["gift", "Сезонные предложения и скидки"]
              ].map(([icon, point], index) => (
                <div className="kol-hero-benefit" key={point} style={{ animationDelay: `${180 + index * 90}ms` }}>
                  <span className="kol-hero-benefit__icon"><PremiumIcon name={icon as "home" | "map_pin" | "shield" | "gift"} size={28} /></span><span>{point}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="kol-hero-stack hidden lg:grid" aria-label="Разделы КЁЛ">
            {[
              { href: "/stays", title: "Жильё", text: "Отели и гостевые дома", image: presentationMedia.kolStays },
              { href: "/tours", title: "Туры", text: "Экскурсии и впечатления", image: presentationMedia.kolTours },
              { href: "/food", title: "Еда", text: "Рестораны и кафе", image: presentationMedia.kolFood },
              { href: "/shop", title: "Магазин", text: "Продукты и всё необходимое", image: presentationMedia.kolShop }
            ].map((item, index) => (
              <Link aria-label={`${item.title}: ${item.text}`} className="kol-hero-stack__card" href={item.href} key={item.href} style={{ animationDelay: `${index * 80}ms` }}>
                <div className="kol-hero-stack__photo" style={{ backgroundImage: `url("${item.image}")` }} />
              </Link>
            ))}
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
                <span className="absolute bottom-3 right-3 rounded-full border border-white/30 bg-slate-950/65 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">{category.meta}</span>
                <span className="sr-only">{category.title}: {category.hook}</span>
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
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75 sm:text-base">Откройте жильё, выберите подходящий район и даты, а затем добавьте туры, доставку и трансфер вокруг своей поездки.</p>
            </div>
            <HeroLink href="/stays" label="Начать с жилья" light />
          </div>
        </section>

        <section className="kol-reveal-soft space-y-6">
          <SectionTitle
            description="Отели, гостевые дома, коттеджи и другие варианты для отдыха у озера."
            eyebrow="Проживание"
            title="Где остановиться"
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {stays.slice(0, 4).map((stay) => <StayCard key={stay.id} stay={stay} />)}
          </div>
          <TextLink href="/stays" label="Смотреть всё проживание" />
        </section>

        <section className="kol-reveal-soft space-y-6">
          <SectionTitle
            description="Маршруты и впечатления, которые можно добавить к поездке."
            eyebrow="Туры и отдых"
            title="Чем заняться"
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tours.slice(0, 3).map((tour) => <TourCard key={tour.id} tour={tour} />)}
          </div>
          <TextLink href="/tours" label="Смотреть все туры и активности" />
        </section>

        <section className="grid gap-12 lg:grid-cols-2 lg:gap-8">
          <div className="kol-reveal-soft space-y-6">
            <SectionTitle description="Рестораны, кафе и локальная кухня рядом с вами." eyebrow="Еда" title="Что поесть" />
            <div className="grid gap-4">
              {foodItems.slice(0, 2).map((food) => (
                <FoodCard food={food} key={food.id} partnerName={getPartnerName(food.businessId)} partnerSlug={getPartnerSlug(food.businessId)} />
              ))}
            </div>
            <TextLink href="/delivery" label="Открыть доставку" />
          </div>

          <div className="kol-reveal-soft space-y-6">
            <SectionTitle description="Полезные вещи, продукты и локальные товары для поездки." eyebrow="Магазин" title="Что купить" />
            <div className="grid gap-4">
              {products.slice(0, 2).map((product) => (
                <ProductCard key={product.id} partnerName={getPartnerName(product.businessId)} partnerSlug={getPartnerSlug(product.businessId)} product={product} />
              ))}
            </div>
            <TextLink href="/delivery" label="Открыть доставку" />
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

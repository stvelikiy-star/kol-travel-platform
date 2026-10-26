import Link from "next/link";
import { FoodCard } from "@/components/cards/FoodCard";
import { ProductCard } from "@/components/cards/ProductCard";
import { StayCard } from "@/components/cards/StayCard";
import { TourCard } from "@/components/cards/TourCard";
import { HomeSearchBar } from "@/components/home/HomeSearchBar";
import { OriginalWinterStage } from "@/components/home/OriginalWinterStage";
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
      title: "Проживание",
      href: "/stays",
      image: "/media/kol/sections/card-stays-winter-960x640.webp"
    },
    {
      title: "Туры и отдых",
      href: "/tours",
      image: "/media/kol/sections/card-tours-winter-960x640.webp"
    },
    {
      title: "Доставка",
      href: "/delivery",
      image: "/media/kol/sections/card-delivery-winter-960x640.webp"
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

      <OriginalWinterStage />

      <Container className="space-y-12 py-8 sm:space-y-14 sm:py-10 lg:space-y-20 lg:py-12">
        <section id="search" className="kol-search-lift relative z-10 -mt-10 rounded-2xl border border-border/90 bg-surface/96 p-3 shadow-soft backdrop-blur sm:-mt-12 sm:p-4 lg:-mt-16 lg:p-5">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-1">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Начните с главного</p>
              <p className="mt-1 text-sm text-muted">Выберите направление — дальше KÖL поможет сузить выбор.</p>
            </div>
          </div>
          <HomeSearchBar />
        </section>

        <section className="kol-reveal-soft space-y-5" aria-labelledby="kol-directions-heading">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Всё для поездки</p>
            <h2 id="kol-directions-heading" className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Выберите направление</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {categories.map((category, index) => (
              <Link
                className="group kol-category-card relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                href={category.href}
                key={category.href}
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <div className="relative aspect-[3/2] w-full overflow-hidden bg-slate-100">
                  <div
                    aria-hidden="true"
                    className="kol-category-photo absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url("${category.image}")` }}
                  />
                  <span aria-hidden="true" className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/95 text-lg font-semibold text-primary shadow-md transition group-hover:translate-x-1">→</span>
                </div>
                <span className="sr-only">{category.title}</span>
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
          <div className="relative grid min-h-[310px] gap-6 p-5 sm:p-9 lg:grid-cols-[1fr_auto] lg:items-end lg:p-12">
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

        <section className="kol-reveal-soft space-y-6">
          <SectionTitle description="Рестораны, кафе, продукты и полезные товары — всё можно добавить в одну корзину." eyebrow="Доставка" title="Еда и покупки для поездки" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {foodItems.slice(0, 2).map((food) => (
              <FoodCard action="cart" food={food} key={food.id} partnerName={getPartnerName(food.businessId)} partnerSlug={getPartnerSlug(food.businessId)} />
            ))}
            {products.slice(0, 2).map((product) => (
              <ProductCard action="cart" key={product.id} partnerName={getPartnerName(product.businessId)} partnerSlug={getPartnerSlug(product.businessId)} product={product} />
            ))}
          </div>
          <TextLink href="/delivery" label="Открыть всю доставку" />
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
    ? "kol-cta-shimmer inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-white bg-white px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-cyan-50 hover:shadow-xl min-[430px]:w-auto"
    : "inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/20 min-[430px]:w-auto";

  return <Link className={className} href={href}>{label}</Link>;
}

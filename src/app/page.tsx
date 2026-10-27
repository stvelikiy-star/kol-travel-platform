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
                  <div data-i18n-ignore="true" className="kol-category-locale-overlay absolute inset-x-0 bottom-0 z-10 hidden min-h-[33%] items-center bg-slate-950/95 px-4 py-3 text-white sm:px-5">
                    <div className="kol-category-locale-ky">
                      <p className="font-semibold text-base sm:text-lg">{index === 0 ? "Турак жай" : index === 1 ? "Турлар жана эс алуу" : "Жеткирүү"}</p>
                      <p className="text-xs text-white/85 sm:text-sm">{index === 0 ? "Каракол · Кышкы эс алуу" : index === 1 ? "Каракол · Тоолор · Кыш" : "Каракол · Тез жана ыңгайлуу"}</p>
                    </div>
                    <div className="kol-category-locale-en">
                      <p className="font-semibold text-base sm:text-lg">{index === 0 ? "Stays" : index === 1 ? "Tours & activities" : "Delivery"}</p>
                      <p className="text-xs text-white/85 sm:text-sm">{index === 0 ? "Karakol · Winter stays" : index === 1 ? "Karakol · Mountains · Winter" : "Karakol · Fast & easy"}</p>
                    </div>
                  </div>
                  <span aria-hidden="true" className="absolute bottom-3 right-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/95 text-lg font-semibold text-primary shadow-md transition group-hover:translate-x-1">→</span>
                </div>
                <span className="sr-only">{category.title}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="kol-story-card relative isolate overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-2xl" aria-labelledby="kol-winter-guide-heading">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-[center_55%]"
            style={{ backgroundImage: 'url("/media/kol/sections/karakol-winter-city-banner.webp")' }}
          />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/60 to-slate-950/5" />
          <div className="relative flex min-h-[300px] items-center p-6 sm:min-h-[330px] sm:p-10 lg:p-12">
            <div className="max-w-[780px]">
              <Badge className="border-white/20 bg-white text-slate-950">Не знаете, с чего начать?</Badge>
              <h2 id="kol-winter-guide-heading" className="mt-5 max-w-[780px] text-3xl font-semibold leading-[1.16] tracking-tight text-white drop-shadow-md sm:text-4xl">
                Сначала выберите место для отдыха. Впечатления добавятся по пути.
              </h2>
              <p className="mt-5 max-w-[700px] text-base leading-7 text-white/95 drop-shadow-md">
                Откройте жильё, выберите подходящий район и даты, а затем добавьте туры, доставку и трансфер вокруг своей поездки.
              </p>
            </div>
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

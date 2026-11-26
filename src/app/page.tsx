import Image from "next/image";
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
import { getHomeVisuals } from "@/lib/data/home-visuals-read";

export default async function Home() {
  const [staysResult, toursResult, foodResult, shopResult, partnersResult, homeVisuals] = await Promise.all([
    getPublicStaysReadResult(),
    getPublicToursReadResult(),
    getPublicFoodReadResult(),
    getPublicShopReadResult(),
    getPublicPartnersReadResult(),
    getHomeVisuals()
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
    <main className="kol-home min-h-screen bg-background bg-cover bg-center bg-no-repeat text-foreground"
      style={homeVisuals.background ? {backgroundImage: `linear-gradient(rgba(245,250,253,.80),rgba(245,250,253,.90)),url("${homeVisuals.background}")`} : undefined}>
      <PublicHeader />

      <OriginalWinterStage />

      <div aria-hidden="true" className="kol-mq" data-i18n-ignore="true">
        <div className="kol-mq-track">
          {[0, 1, 2, 3].map((group) => (
            <div className="kol-mq-group" key={group}>
              {["Проживание", "Туры", "Доставка", "Трансфер", "Иссык-Куль", "Ысык-Көл", "Всё рядом"].map((word) => (
                <span className="contents" key={word}>{word}<i /></span>
              ))}
            </div>
          ))}
        </div>
      </div>

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

        {homeVisuals.banner ? (
          <section aria-label="Баннер сайта" className="overflow-hidden rounded-2xl border border-border/70 bg-surface shadow-soft">
            {homeVisuals.bannerLink ? (
              <Link href={homeVisuals.bannerLink} rel={homeVisuals.bannerLink.startsWith("https://") ? "noopener noreferrer" : undefined}
                className="block focus-visible:outline-2 focus-visible:outline-primary">
                <Image unoptimized width={1440} height={420} src={homeVisuals.banner} alt="Баннер KÖL" loading="lazy"
                  className="h-auto max-h-[390px] w-full object-cover" />
              </Link>
            ) : (
              <Image unoptimized width={1440} height={420} src={homeVisuals.banner} alt="Баннер KÖL" loading="lazy"
                className="h-auto max-h-[390px] w-full object-cover" />
            )}
          </section>
        ) : null}

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
                  <div data-i18n-ignore="true" className="kol-category-brand-overlay pointer-events-none absolute left-0 top-0 z-10 hidden h-[34%] w-[49%] flex-col justify-start bg-gradient-to-r from-slate-950/95 via-slate-950/90 to-transparent px-4 py-3 text-white sm:px-5">
                    <strong className="text-2xl font-black tracking-tight text-cyan-300 drop-shadow sm:text-3xl">KÖL</strong>
                    <span className="kol-category-brand-ky text-[10px] font-semibold uppercase tracking-widest text-white/90">Баары жакын</span>
                    <span className="kol-category-brand-en text-[10px] font-semibold uppercase tracking-wide text-white/90">Всё рядом</span>
                  </div>
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

        <section className="kol-reveal-soft kol-num space-y-6">
          <SectionTitle
            description="Отели, гостевые дома, коттеджи и другие варианты для отдыха у озера."
            eyebrow="Проживание"
            title="Где остановиться"
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {stays.slice(0, 4).map((stay, i) => <div className="kol-rv h-full" key={stay.id} style={{ ["--i" as string]: i % 3 }}><StayCard stay={stay} /></div>)}
          </div>
          <TextLink href="/stays" label="Смотреть всё проживание" />
        </section>

        <section className="kol-reveal-soft kol-num space-y-6">
          <SectionTitle
            description="Маршруты и впечатления, которые можно добавить к поездке."
            eyebrow="Туры и отдых"
            title="Чем заняться"
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tours.slice(0, 3).map((tour, i) => <div className="kol-rv h-full" key={tour.id} style={{ ["--i" as string]: i }}><TourCard tour={tour} /></div>)}
          </div>
          <TextLink href="/tours" label="Смотреть все туры и активности" />
        </section>

        <section className="kol-reveal-soft kol-num space-y-6">
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

        <section className="kol-num space-y-6" aria-labelledby="kol-how-heading">
          <div className="kol-sh kol-rvl max-w-3xl space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Как это работает</p>
            <h2 id="kol-how-heading" className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">Четыре шага до заявки</h2>
            <p className="text-base leading-7 text-muted">Заявка не гарантирует бронь — детали подтверждает исполнитель.</p>
          </div>
          <div className="kol-steps">
            {[
              ["1", "⌕", "Выберите направление", "Проживание, туры, доставка или трансфер."],
              ["2", "✎", "Укажите детали", "Даты, гостей, маршрут или адрес доставки."],
              ["3", "✉", "Оставьте заявку", "Заявка уходит партнёру."],
              ["4", "✓", "Подтвердите у исполнителя", "Условия и наличие уточняет партнёр."]
            ].map(([n, icon, title, text], i) => (
              <div className="kol-rv" key={n} style={{ ["--i" as string]: i }}>
                <div className="kol-st">
                  <span aria-hidden="true" className="big">{n}</span>
                  <div aria-hidden="true" className="kol-ico">{icon}</div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="kol-trust">
          {[
            ["Жильё, туры и покупки в одном месте", "Всё для поездки на Иссык-Куль — без десятков вкладок."],
            ["Понятный путь от выбора до оформления", "Выберите, добавьте в поездку и оставьте заявку."],
            ["Русский, кыргызский и английский", "Сайт доступен на трёх языках."]
          ].map(([title, text], i) => (
            <div className="kol-rv" key={title} style={{ ["--i" as string]: i }}>
              <div className="kol-st">
                <h3 className="mt-0">{title}</h3>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="kol-fin kol-rv" aria-labelledby="kol-final-heading">
          <div aria-hidden="true" className="kol-snow">
            {[4, 11, 18, 25, 33, 41, 48, 55, 62, 69, 76, 83, 90, 96].map((x, i) => (
              <i key={x} style={{ ["--x" as string]: `${x}%`, ["--s" as string]: `${3 + (i % 4)}px`, ["--d" as string]: `${9 + (i % 6)}s`, ["--dl" as string]: `-${(i * 3) % 11}s` }} />
            ))}
          </div>
          <h2 id="kol-final-heading">Соберите свой Иссык-Куль в одном месте</h2>
          <p>Проживание, туры, доставка и трансфер — оставьте заявку, а остальное соберём вокруг вашей поездки.</p>
          <div className="row">
            <Link className="kol-hbtn kol-hbtn--turq kol-shim" href="/checkout">Оставить заявку</Link>
            <Link className="kol-hbtn kol-hbtn--glass" href="/stays">Подобрать жильё</Link>
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

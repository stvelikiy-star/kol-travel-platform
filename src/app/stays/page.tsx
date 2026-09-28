import { CatalogSection } from "@/components/catalog/CatalogSection";
import { presentationMedia } from "@/lib/presentation-media";
import { CatalogToolbar } from "@/components/catalog/CatalogToolbar";
import { EmptyState } from "@/components/catalog/EmptyState";
import { StayCard } from "@/components/cards/StayCard";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Container } from "@/components/ui/Container";
import { getPublicStaysReadResult } from "@/lib/data/public-stays-read";

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

const locationOptions = [
  { label: "Чолпон-Ата", value: "Чолпон-Ата" },
  { label: "Бостери", value: "Бостери" },
  { label: "Каракол", value: "Каракол" },
  { label: "Тамчы", value: "Тамчы" },
  { label: "Бактуу-Долоноту", value: "Бактуу-Долоноту" }
];

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function StaysPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const q = valueOf(params.q).trim().toLocaleLowerCase("ru");
  const location = valueOf(params.location);
  const category = valueOf(params.category);
  const sort = valueOf(params.sort) || "rating";

  const readResult = await getPublicStaysReadResult();
  const stays = readResult.items
    .filter((stay) => !q || `${stay.title} ${stay.description}`.toLocaleLowerCase("ru").includes(q))
    .filter((stay) => !location || location === "all" || stay.location === location)
    .filter((stay) => !category || category === "all" || stay.type === category)
    .sort((a, b) => {
      if (sort === "price-asc") return a.minPricePerNight - b.minPricePerNight;
      if (sort === "price-desc") return b.minPricePerNight - a.minPricePerNight;
      return b.rating - a.rating;
    });
  const isEmpty = stays.length === 0;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <section className="kol-catalog-hero relative overflow-hidden text-white">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${presentationMedia.travelerDock}")` }} />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/64 to-slate-950/20" />
        <Container className="relative py-14 sm:py-16">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">КЁЛ · ВСЁ РЯДОМ</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">Жильё на Иссык-Куле</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/82 sm:text-lg">Отели, гостевые дома, коттеджи и юрточные лагеря — выбирайте место отдыха по локации, формату и цене.</p>
        </Container>
      </section>
      <Container className="py-10">
        <CatalogSection
          description="От гостевых домов до премиум-вилл, коттеджей и юрточных лагерей по всему Иссык-Кулю."
          emptyState={<EmptyState actionLabel="Сбросить фильтры" description="Попробуйте изменить локацию, поиск или тип жилья." href="/stays" title="Жильё не найдено" />}
          isEmpty={isEmpty}
          title="Жильё и ночлег"
          toolbar={
            <CatalogToolbar
              categoryLabel="Тип жилья"
              categoryOptions={[
                { label: "Гостевой дом", value: "guest_house" },
                { label: "Отель", value: "hotel" },
                { label: "Коттедж", value: "cottage" },
                { label: "Юрточный лагерь", value: "yurt_camp" },
                { label: "Вилла", value: "villa" }
              ]}
              locationOptions={locationOptions}
              resetHref="/stays"
              resultCount={stays.length}
              searchPlaceholder="Название жилья"
              sortOptions={[
                { label: "По рейтингу", value: "rating" },
                { label: "Цена за ночь ↑", value: "price-asc" },
                { label: "Цена за ночь ↓", value: "price-desc" }
              ]}
              values={{ q: valueOf(params.q), location, category, sort }}
            />
          }
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {stays.map((stay) => <StayCard key={stay.id} stay={stay} />)}
          </div>
        </CatalogSection>
      </Container>
      <PublicFooter />
    </main>
  );
}

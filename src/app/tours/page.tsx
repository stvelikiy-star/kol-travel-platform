import { CatalogSection } from "@/components/catalog/CatalogSection";
import { CatalogToolbar } from "@/components/catalog/CatalogToolbar";
import { EmptyState } from "@/components/catalog/EmptyState";
import { TourCard } from "@/components/cards/TourCard";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Container } from "@/components/ui/Container";
import { getPublicToursReadResult } from "@/lib/data/public-tours-read";

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

const locationOptions = [
  { label: "Чолпон-Ата", value: "Чолпон-Ата" },
  { label: "Бостери", value: "Бостери" },
  { label: "Каракол", value: "Каракол" },
  { label: "Тамчы", value: "Тамчы" },
  { label: "Сары-Ой", value: "Сары-Ой" }
];

const tourCategoryById: Record<string, string> = {
  "tour-boat-cholpon-ata": "boat",
  "tour-horse-bosteri": "horse",
  "tour-hot-springs-karakol": "hot-springs",
  "tour-jeep-sary-oi": "jeep",
  "tour-ethno-tamchy": "ethno",
  "tour-karakol-city": "excursion"
};

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ToursPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const q = valueOf(params.q).trim().toLocaleLowerCase("ru");
  const location = valueOf(params.location);
  const category = valueOf(params.category);
  const sort = valueOf(params.sort) || "rating";

  const readResult = await getPublicToursReadResult();
  const tours = readResult.items
    .filter((tour) => !q || `${tour.title} ${tour.description}`.toLocaleLowerCase("ru").includes(q))
    .filter((tour) => !location || location === "all" || tour.location === location)
    .filter((tour) => !category || category === "all" || tourCategoryById[tour.id] === category)
    .sort((a, b) => {
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "price-desc") return b.price - a.price;
      return b.rating - a.rating;
    });
  const isEmpty = tours.length === 0;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="py-10">
        <CatalogSection
          description="Катера, конные прогулки, горячие источники, джип-туры, экскурсии и локальные впечатления."
          emptyState={<EmptyState actionLabel="Сбросить фильтры" description="Попробуйте изменить локацию, поиск, тип тура или сортировку." href="/tours" title="Туры не найдены" />}
          isEmpty={isEmpty}
          title="Туры по Иссык-Кулю"
          toolbar={
            <CatalogToolbar
              categoryLabel="Тип тура"
              categoryOptions={[
                { label: "Катер", value: "boat" },
                { label: "Конная прогулка", value: "horse" },
                { label: "Горячие источники", value: "hot-springs" },
                { label: "Джип-тур", value: "jeep" },
                { label: "Этно-тур", value: "ethno" },
                { label: "Экскурсия", value: "excursion" }
              ]}
              locationOptions={locationOptions}
              resetHref="/tours"
              resultCount={tours.length}
              searchPlaceholder="Название тура"
              sortOptions={[
                { label: "По рейтингу", value: "rating" },
                { label: "Цена по возрастанию", value: "price-asc" },
                { label: "Цена по убыванию", value: "price-desc" }
              ]}
              values={{ q: valueOf(params.q), location, category, sort }}
            />
          }
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tours.map((tour) => <TourCard key={tour.id} tour={tour} />)}
          </div>
        </CatalogSection>
      </Container>
      <PublicFooter />
    </main>
  );
}

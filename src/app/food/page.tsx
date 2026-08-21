import { CatalogSection } from "@/components/catalog/CatalogSection";
import { CatalogToolbar } from "@/components/catalog/CatalogToolbar";
import { EmptyState } from "@/components/catalog/EmptyState";
import { FoodCard } from "@/components/cards/FoodCard";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Container } from "@/components/ui/Container";
import { getPublicFoodReadResult } from "@/lib/data/public-catalog-read";
import { getPartnerById } from "@/lib/data/partners";

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

const locationOptions = [
  { label: "Чолпон-Ата", value: "Чолпон-Ата" },
  { label: "Бостери", value: "Бостери" },
  { label: "Тамчы", value: "Тамчы" },
  { label: "Сары-Ой", value: "Сары-Ой" }
];

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function getPartnerName(businessId: string) {
  return getPartnerById(businessId)?.title ?? "KÖL Partner";
}

function getPartnerSlug(businessId: string) {
  return getPartnerById(businessId)?.slug;
}

export default async function FoodPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const q = valueOf(params.q).trim().toLocaleLowerCase("ru");
  const location = valueOf(params.location);
  const category = valueOf(params.category);
  const sort = valueOf(params.sort) || "price-asc";

  const readResult = await getPublicFoodReadResult();
  const foodItems = readResult.items
    .filter((food) => !q || `${food.title} ${food.description} ${getPartnerName(food.businessId)}`.toLocaleLowerCase("ru").includes(q))
    .filter((food) => {
      if (!location || location === "all") return true;
      return getPartnerById(food.businessId)?.location === location;
    })
    .filter((food) => !category || category === "all" || food.category === category)
    .sort((a, b) => {
      if (sort === "price-desc") return b.price - a.price;
      if (sort === "title") return a.title.localeCompare(b.title, "ru");
      return a.price - b.price;
    });
  const isEmpty = foodItems.length === 0;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="py-10">
        <CatalogSection
          description="Рестораны, кафе, завтраки, шашлык и национальная кухня рядом с вами."
          emptyState={<EmptyState actionLabel="Сбросить фильтры" description="Попробуйте изменить локацию, кухню, поиск или сортировку." href="/food" title="Блюда не найдены" />}
          isEmpty={isEmpty}
          title="Еда и доставка"
          toolbar={
            <CatalogToolbar
              categoryLabel="Кухня"
              categoryOptions={[
                { label: "Национальная кухня", value: "Национальная кухня" },
                { label: "Кафе", value: "Кафе" },
                { label: "Шашлык", value: "Шашлык" },
                { label: "Завтраки", value: "Завтраки" },
                { label: "Доставка", value: "Доставка" }
              ]}
              locationOptions={locationOptions}
              resetHref="/food"
              resultCount={foodItems.length}
              searchPlaceholder="Название блюда"
              sortOptions={[
                { label: "Цена ↑", value: "price-asc" },
                { label: "Цена ↓", value: "price-desc" },
                { label: "По названию", value: "title" }
              ]}
              values={{ q: valueOf(params.q), location, category, sort }}
            />
          }
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {foodItems.map((food) => (
              <FoodCard food={food} key={food.id} partnerName={getPartnerName(food.businessId)} partnerSlug={getPartnerSlug(food.businessId)} />
            ))}
          </div>
        </CatalogSection>
      </Container>
      <PublicFooter />
    </main>
  );
}

import { CatalogSection } from "@/components/catalog/CatalogSection";
import { CatalogToolbar } from "@/components/catalog/CatalogToolbar";
import { EmptyState } from "@/components/catalog/EmptyState";
import { FoodCard } from "@/components/cards/FoodCard";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Container } from "@/components/ui/Container";
import { getPublicFoodReadResult } from "@/lib/data/public-catalog-read";
import { getPartnerById } from "@/lib/data/partners";

const locationOptions = [
  { label: "Чолпон-Ата", value: "cholpon-ata" },
  { label: "Бостери", value: "bosteri" },
  { label: "Тамчы", value: "tamchy" },
  { label: "Сары-Ой", value: "sary-oi" }
];

function getPartnerName(businessId: string) {
  return getPartnerById(businessId)?.title ?? "KÖL Partner";
}

function getPartnerSlug(businessId: string) {
  return getPartnerById(businessId)?.slug;
}

export default async function FoodPage() {
  const readResult = await getPublicFoodReadResult();
  const foodItems = readResult.items;
  const isEmpty = foodItems.length === 0;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="py-10">
        <CatalogSection
          description="Рестораны, кафе, завтраки, шашлык и национальная кухня рядом с вами."
          emptyState={
            <EmptyState
              actionLabel="Сбросить фильтры"
              description="Попробуйте изменить локацию, кухню, статус или сортировку."
              title="Блюда не найдены"
            />
          }
          isEmpty={isEmpty}
          title="Еда и доставка"
          toolbar={
            <CatalogToolbar
              categoryLabel="Кухня"
              categoryOptions={[
                { label: "Национальная кухня", value: "national" },
                { label: "Кафе", value: "cafe" },
                { label: "Шашлык", value: "bbq" },
                { label: "Завтраки", value: "breakfast" },
                { label: "Доставка", value: "delivery" }
              ]}
              locationOptions={locationOptions}
              resultCount={foodItems.length}
              searchPlaceholder="Название блюда"
              sortOptions={[
                { label: "Открыто сейчас", value: "open-now" },
                { label: "Быстрая доставка", value: "fast-delivery" },
                { label: "Популярные", value: "popular" },
                { label: "Рейтинг", value: "rating" }
              ]}
            />
          }
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {foodItems.map((food) => (
              <FoodCard
                food={food}
                key={food.id}
                partnerName={getPartnerName(food.businessId)}
                partnerSlug={getPartnerSlug(food.businessId)}
              />
            ))}
          </div>
        </CatalogSection>
      </Container>
      <PublicFooter />
    </main>
  );
}

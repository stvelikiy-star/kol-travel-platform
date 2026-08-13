import { CatalogSection } from "@/components/catalog/CatalogSection";
import { CatalogToolbar } from "@/components/catalog/CatalogToolbar";
import { EmptyState } from "@/components/catalog/EmptyState";
import { TourCard } from "@/components/cards/TourCard";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { getPublicToursReadResult } from "@/lib/data/public-tours-read";

const locationOptions = [
  { label: "Чолпон-Ата", value: "cholpon-ata" },
  { label: "Бостери", value: "bosteri" },
  { label: "Каракол", value: "karakol" },
  { label: "Тамчы", value: "tamchy" },
  { label: "Сары-Ой", value: "sary-oi" }
];

export default async function ToursPage() {
  const readResult = await getPublicToursReadResult();
  const tours = readResult.items;
  const isEmpty = tours.length === 0;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="py-10">
        <Card className="mb-4">
          <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
            <Badge variant={readResult.source === "supabase" ? "warning" : readResult.source === "fallback" ? "muted" : "info"}>
              {readResult.source === "supabase"
                ? "Supabase read pilot"
                : readResult.source === "fallback"
                  ? "Fallback to mock data"
                  : "Mock data mode"}
            </Badge>
            {readResult.code ? <Badge variant="muted">{readResult.code}</Badge> : null}
            <span className="text-muted">
              {readResult.message ?? "Tours catalog is loaded through the public tours read wrapper."}
            </span>
          </CardContent>
        </Card>

        <CatalogSection
          description="Катера, конные прогулки, горячие источники, джип-туры и экскурсии."
          emptyState={
            <EmptyState
              actionLabel="Сбросить фильтры"
              description="Попробуйте изменить локацию, дату, тип тура или сортировку."
              title="Туры не найдены"
            />
          }
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
                { label: "Экскурсия", value: "excursion" }
              ]}
              locationOptions={locationOptions}
              resultCount={tours.length}
              searchPlaceholder="Название тура"
              sortOptions={[
                { label: "Популярные", value: "popular" },
                { label: "Цена по возрастанию", value: "price-asc" },
                { label: "Цена по убыванию", value: "price-desc" },
                { label: "Рейтинг", value: "rating" }
              ]}
            />
          }
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tours.map((tour) => (
              <TourCard key={tour.id} tour={tour} />
            ))}
          </div>
        </CatalogSection>
      </Container>
      <PublicFooter />
    </main>
  );
}

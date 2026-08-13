import { CatalogSection } from "@/components/catalog/CatalogSection";
import { CatalogToolbar } from "@/components/catalog/CatalogToolbar";
import { EmptyState } from "@/components/catalog/EmptyState";
import { ProductCard } from "@/components/cards/ProductCard";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { getPublicShopReadResult } from "@/lib/data/public-shop-read";
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

export default async function ShopPage() {
  const readResult = await getPublicShopReadResult();
  const products = readResult.items;
  const isEmpty = products.length === 0;

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
            {readResult.safetyFiltered ? <Badge variant="warning">Safety filtered</Badge> : null}
            {readResult.code ? <Badge variant="muted">{readResult.code}</Badge> : null}
            <span className="text-muted">
              {readResult.message ?? "Shop catalog is loaded through the public shop read wrapper."}
            </span>
          </CardContent>
        </Card>

        <CatalogSection
          description="Продукты, товары для пляжа, мангал, уголь, сувениры и всё для отдыха."
          emptyState={
            <EmptyState
              actionLabel="Сбросить фильтры"
              description="Попробуйте изменить категорию, локацию, наличие или сортировку."
              title="Товары не найдены"
            />
          }
          isEmpty={isEmpty}
          title="Магазин для отдыха"
          toolbar={
            <CatalogToolbar
              categoryLabel="Категория"
              categoryOptions={[
                { label: "Продукты", value: "grocery" },
                { label: "Товары для отдыха", value: "leisure" },
                { label: "Мангал/уголь", value: "bbq" },
                { label: "Пляжные товары", value: "beach" },
                { label: "Сувениры", value: "souvenirs" }
              ]}
              locationOptions={locationOptions}
              resultCount={products.length}
              searchPlaceholder="Название товара"
              sortOptions={[
                { label: "В наличии", value: "in-stock" },
                { label: "Цена ↑", value: "price-asc" },
                { label: "Цена ↓", value: "price-desc" },
                { label: "Популярные", value: "popular" }
              ]}
            />
          }
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                partnerName={getPartnerName(product.businessId)}
                partnerSlug={getPartnerSlug(product.businessId)}
                product={product}
              />
            ))}
          </div>
        </CatalogSection>
      </Container>
      <PublicFooter />
    </main>
  );
}

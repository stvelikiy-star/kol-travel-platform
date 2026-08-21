import { CatalogSection } from "@/components/catalog/CatalogSection";
import { CatalogToolbar } from "@/components/catalog/CatalogToolbar";
import { EmptyState } from "@/components/catalog/EmptyState";
import { ProductCard } from "@/components/cards/ProductCard";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Container } from "@/components/ui/Container";
import { getPublicShopReadResult } from "@/lib/data/public-shop-read";
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

export default async function ShopPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const q = valueOf(params.q).trim().toLocaleLowerCase("ru");
  const location = valueOf(params.location);
  const category = valueOf(params.category);
  const sort = valueOf(params.sort) || "in-stock";

  const readResult = await getPublicShopReadResult();
  const products = readResult.items
    .filter((product) => !q || `${product.title} ${product.description} ${getPartnerName(product.businessId)}`.toLocaleLowerCase("ru").includes(q))
    .filter((product) => {
      if (!location || location === "all") return true;
      return getPartnerById(product.businessId)?.location === location;
    })
    .filter((product) => !category || category === "all" || product.category === category)
    .sort((a, b) => {
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "price-desc") return b.price - a.price;
      if (sort === "title") return a.title.localeCompare(b.title, "ru");
      const aAvailable = a.status === "active" ? 0 : 1;
      const bAvailable = b.status === "active" ? 0 : 1;
      return aAvailable - bAvailable || a.title.localeCompare(b.title, "ru");
    });
  const isEmpty = products.length === 0;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="py-10">
        <CatalogSection
          description="Продукты, товары для пляжа, мангал, уголь, сувениры и всё необходимое для отдыха."
          emptyState={<EmptyState actionLabel="Сбросить фильтры" description="Попробуйте изменить категорию, локацию, поиск или сортировку." href="/shop" title="Товары не найдены" />}
          isEmpty={isEmpty}
          title="Магазин для отдыха"
          toolbar={
            <CatalogToolbar
              categoryLabel="Категория"
              categoryOptions={[
                { label: "Продукты", value: "Продукты" },
                { label: "Товары для отдыха", value: "Товары для отдыха" },
                { label: "Мангал/уголь", value: "Мангал/уголь" },
                { label: "Пляжные товары", value: "Пляжные товары" },
                { label: "Сувениры", value: "Сувениры" }
              ]}
              locationOptions={locationOptions}
              resetHref="/shop"
              resultCount={products.length}
              searchPlaceholder="Название товара"
              sortOptions={[
                { label: "Сначала в наличии", value: "in-stock" },
                { label: "Цена ↑", value: "price-asc" },
                { label: "Цена ↓", value: "price-desc" },
                { label: "По названию", value: "title" }
              ]}
              values={{ q: valueOf(params.q), location, category, sort }}
            />
          }
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.id} partnerName={getPartnerName(product.businessId)} partnerSlug={getPartnerSlug(product.businessId)} product={product} />
            ))}
          </div>
        </CatalogSection>
      </Container>
      <PublicFooter />
    </main>
  );
}

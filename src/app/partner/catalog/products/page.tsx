import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerCatalogList } from "@/components/partner/PartnerCatalogList";
import { getPartnerCatalogCategoriesReadResult, getPartnerProductsCatalogReadResult } from "@/lib/data/partner-catalog-read";

export default async function PartnerProductsCatalogPage() {
  const [result, categories] = await Promise.all([
    getPartnerProductsCatalogReadResult(),
    getPartnerCatalogCategoriesReadResult("products")
  ]);

  return (
    <PartnerLayout>
      <PartnerCatalogList
        categories={categories}
        description="Создание, изменение и отправка товаров на проверку доступны только после подтверждения доступа к бизнесу. Без проверки прав изменения блокируются."
        domain="products"
        result={result}
        title="Каталог товаров партнёра"
      />
    </PartnerLayout>
  );
}

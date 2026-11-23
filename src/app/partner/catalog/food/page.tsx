import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerCatalogList } from "@/components/partner/PartnerCatalogList";
import { getPartnerCatalogCategoriesReadResult, getPartnerFoodCatalogReadResult } from "@/lib/data/partner-catalog-read";

export default async function PartnerFoodCatalogPage() {
  const [result, categories] = await Promise.all([
    getPartnerFoodCatalogReadResult(),
    getPartnerCatalogCategoriesReadResult("food")
  ]);

  return (
    <PartnerLayout>
      <PartnerCatalogList
        categories={categories}
        description="Создание, изменение и отправка блюд на проверку доступны только после подтверждения доступа к бизнесу. Без проверки прав изменения блокируются."
        domain="food"
        result={result}
        title="Каталог блюд партнёра"
      />
    </PartnerLayout>
  );
}

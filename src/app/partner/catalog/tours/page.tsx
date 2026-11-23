import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerCatalogList } from "@/components/partner/PartnerCatalogList";
import { getPartnerCatalogCategoriesReadResult, getPartnerToursCatalogReadResult } from "@/lib/data/partner-catalog-read";

export default async function PartnerToursCatalogPage() {
  const [result, categories] = await Promise.all([
    getPartnerToursCatalogReadResult(),
    getPartnerCatalogCategoriesReadResult("tours")
  ]);

  return (
    <PartnerLayout>
      <PartnerCatalogList
        categories={categories}
        description="Создание, изменение и отправка туров на проверку доступны только после подтверждения доступа к бизнесу. Без проверки прав изменения блокируются."
        domain="tours"
        result={result}
        title="Каталог туров партнёра"
      />
    </PartnerLayout>
  );
}

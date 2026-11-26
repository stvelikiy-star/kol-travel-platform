import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerCatalogList } from "@/components/partner/PartnerCatalogList";
import { getPartnerCatalogCategoriesReadResult, getPartnerStaysCatalogReadResult } from "@/lib/data/partner-catalog-read";

export default async function PartnerStaysCatalogPage() {
  const [result, categories] = await Promise.all([
    getPartnerStaysCatalogReadResult(),
    getPartnerCatalogCategoriesReadResult("stays")
  ]);

  return (
    <PartnerLayout>
      <PartnerCatalogList
        categories={categories}
        description="Создание, изменение и отправка жилья на проверку доступны только после подтверждения доступа к бизнесу. Без проверки прав изменения блокируются."
        domain="stays"
        result={result}
        title="Каталог жилья партнёра"
      />
    </PartnerLayout>
  );
}

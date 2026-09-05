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
        description="Stay drafts can be created, edited and submitted through the scoped RPC runtime when Supabase ownership is confirmed. Otherwise writes fail closed."
        domain="stays"
        result={result}
        title="Partner stays catalog"
      />
    </PartnerLayout>
  );
}

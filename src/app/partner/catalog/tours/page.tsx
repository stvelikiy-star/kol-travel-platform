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
        description="Tour drafts can be created, edited and submitted through the scoped RPC runtime when Supabase ownership is confirmed. Otherwise writes fail closed."
        domain="tours"
        result={result}
        title="Partner tours catalog"
      />
    </PartnerLayout>
  );
}

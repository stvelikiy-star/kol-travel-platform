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
        description="Food drafts can be created, edited and submitted through the scoped RPC runtime when Supabase ownership is confirmed. Otherwise writes fail closed."
        domain="food"
        result={result}
        title="Partner food catalog"
      />
    </PartnerLayout>
  );
}

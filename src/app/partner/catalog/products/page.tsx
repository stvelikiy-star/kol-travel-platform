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
        description="Product drafts can be created, edited and submitted through the scoped RPC runtime when Supabase ownership is confirmed. Otherwise writes fail closed."
        domain="products"
        result={result}
        title="Partner products catalog"
      />
    </PartnerLayout>
  );
}

import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerCatalogList } from "@/components/partner/PartnerCatalogList";
import { getPartnerFoodCatalogReadResult } from "@/lib/data/partner-catalog-read";

export default async function PartnerFoodCatalogPage() {
  const result = await getPartnerFoodCatalogReadResult();

  return (
    <PartnerLayout>
      <PartnerCatalogList
        description="Food/menu items visible to the partner as a read-only management preview."
        result={result}
        title="Partner food catalog"
      />
    </PartnerLayout>
  );
}

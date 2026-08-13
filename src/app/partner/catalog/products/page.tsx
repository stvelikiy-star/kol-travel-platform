import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerCatalogList } from "@/components/partner/PartnerCatalogList";
import { getPartnerProductsCatalogReadResult } from "@/lib/data/partner-catalog-read";

export default async function PartnerProductsCatalogPage() {
  const result = await getPartnerProductsCatalogReadResult();

  return (
    <PartnerLayout>
      <PartnerCatalogList
        description="Shop product records visible to the partner as a read-only management preview."
        result={result}
        title="Partner products catalog"
      />
    </PartnerLayout>
  );
}

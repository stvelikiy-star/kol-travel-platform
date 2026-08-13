import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerCatalogList } from "@/components/partner/PartnerCatalogList";
import { getPartnerToursCatalogReadResult } from "@/lib/data/partner-catalog-read";

export default async function PartnerToursCatalogPage() {
  const result = await getPartnerToursCatalogReadResult();

  return (
    <PartnerLayout>
      <PartnerCatalogList
        description="Tour records visible to the partner as a read-only management preview."
        result={result}
        title="Partner tours catalog"
      />
    </PartnerLayout>
  );
}

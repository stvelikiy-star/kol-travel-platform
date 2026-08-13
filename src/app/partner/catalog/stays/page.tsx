import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerCatalogList } from "@/components/partner/PartnerCatalogList";
import { getPartnerStaysCatalogReadResult } from "@/lib/data/partner-catalog-read";

export default async function PartnerStaysCatalogPage() {
  const result = await getPartnerStaysCatalogReadResult();

  return (
    <PartnerLayout>
      <PartnerCatalogList
        description="Stay/accommodation records visible to the partner as a read-only management preview."
        result={result}
        title="Partner stays catalog"
      />
    </PartnerLayout>
  );
}

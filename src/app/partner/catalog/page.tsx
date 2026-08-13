import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerCatalogOverview } from "@/components/partner/PartnerCatalogOverview";
import { getPartnerCatalogOverviewReadResult } from "@/lib/data/partner-catalog-read";

export default async function PartnerCatalogPage() {
  const result = await getPartnerCatalogOverviewReadResult();

  return (
    <PartnerLayout>
      <PartnerCatalogOverview result={result} />
    </PartnerLayout>
  );
}

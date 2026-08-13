import { Badge } from "@/components/ui/Badge";

export function PartnerCatalogSafetyBadge({ flags = [] }: { flags?: string[] }) {
  if (flags.length === 0) {
    return <Badge variant="success">safe</Badge>;
  }

  return <Badge variant="danger">safety flagged</Badge>;
}

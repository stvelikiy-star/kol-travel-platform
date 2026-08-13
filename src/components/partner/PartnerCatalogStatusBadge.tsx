import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import type { PartnerCatalogStatus } from "@/lib/types/partner-catalog";

const statusVariant: Record<PartnerCatalogStatus, BadgeVariant> = {
  active: "success",
  approved: "info",
  archived: "muted",
  draft: "muted",
  published: "success",
  rejected: "danger",
  under_review: "warning",
  unknown: "muted"
};

export function PartnerCatalogStatusBadge({ status }: { status: PartnerCatalogStatus }) {
  return <Badge variant={statusVariant[status]}>{status}</Badge>;
}

import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import type { AdminCatalogStatus } from "@/lib/types/admin-catalog";

const statusVariant: Record<AdminCatalogStatus, BadgeVariant> = {
  active: "success",
  approved: "info",
  archived: "muted",
  draft: "muted",
  published: "success",
  rejected: "danger",
  safety_flagged: "danger",
  under_review: "warning",
  unknown: "muted"
};

export function AdminCatalogStatusBadge({ status }: { status: AdminCatalogStatus }) {
  return <Badge variant={statusVariant[status]}>{status}</Badge>;
}

import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import type { PartnerCatalogMode } from "@/lib/types/partner-catalog";

const modeLabel: Record<PartnerCatalogMode, string> = {
  auth_missing: "Auth missing",
  business_inactive: "Business inactive",
  business_missing: "Business missing",
  empty_result: "Empty result",
  fallback_to_mock: "Fallback to mock data",
  mock_mode: "Mock data mode",
  ownership_mismatch: "Ownership mismatch",
  partner_profile_missing: "Partner profile missing",
  read_failed: "Read failed",
  server_error: "Safe read error",
  supabase_success: "Supabase read pilot"
};

const modeVariant: Record<PartnerCatalogMode, BadgeVariant> = {
  auth_missing: "warning",
  business_inactive: "warning",
  business_missing: "warning",
  empty_result: "muted",
  fallback_to_mock: "warning",
  mock_mode: "muted",
  ownership_mismatch: "warning",
  partner_profile_missing: "warning",
  read_failed: "danger",
  server_error: "danger",
  supabase_success: "info"
};

export function PartnerCatalogModeBadge({ mode }: { mode: PartnerCatalogMode }) {
  return <Badge variant={modeVariant[mode]}>{modeLabel[mode]}</Badge>;
}

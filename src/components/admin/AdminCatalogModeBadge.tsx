import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import type { AdminCatalogMode } from "@/lib/types/admin-catalog";

const modeLabel: Record<AdminCatalogMode, string> = {
  admin_auth_missing: "Admin auth missing",
  admin_role_missing: "Admin role missing",
  admin_role_source_missing: "Admin role source missing",
  empty_result: "Empty result",
  fallback_to_mock: "Fallback to mock data",
  mock_mode: "Mock data mode",
  read_failed: "Read failed",
  server_error: "Safe read error",
  supabase_success: "Supabase read pilot"
};

const modeVariant: Record<AdminCatalogMode, BadgeVariant> = {
  admin_auth_missing: "warning",
  admin_role_missing: "warning",
  admin_role_source_missing: "warning",
  empty_result: "muted",
  fallback_to_mock: "warning",
  mock_mode: "muted",
  read_failed: "danger",
  server_error: "danger",
  supabase_success: "info"
};

export function AdminCatalogModeBadge({ mode }: { mode: AdminCatalogMode }) {
  return <Badge variant={modeVariant[mode]}>{modeLabel[mode]}</Badge>;
}

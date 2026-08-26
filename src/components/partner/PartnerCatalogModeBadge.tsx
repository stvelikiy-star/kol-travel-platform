import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import type { PartnerCatalogMode } from "@/lib/types/partner-catalog";

const modeLabel: Record<PartnerCatalogMode, string> = {
  auth_missing: "Нужна авторизация",
  business_inactive: "Бизнес не активен",
  business_missing: "Бизнес не найден",
  empty_result: "Каталог пуст",
  fallback_to_mock: "Демонстрационный источник",
  mock_mode: "Безопасное демо",
  ownership_mismatch: "Нет доступа к бизнесу",
  partner_profile_missing: "Профиль партнёра не найден",
  read_failed: "Данные недоступны",
  server_error: "Ошибка чтения",
  supabase_success: "Подтверждённые данные"
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

import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import type { AdminCatalogMode } from "@/lib/types/admin-catalog";

const modeLabel: Record<AdminCatalogMode, string> = {
  admin_auth_missing: "Нужна авторизация",
  admin_role_missing: "Нет прав администратора",
  admin_role_source_missing: "Права не подтверждены",
  empty_result: "Каталог пуст",
  fallback_to_mock: "Демонстрационный источник",
  mock_mode: "Безопасное демо",
  read_failed: "Данные недоступны",
  server_error: "Ошибка чтения",
  supabase_success: "Подтверждённые данные"
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

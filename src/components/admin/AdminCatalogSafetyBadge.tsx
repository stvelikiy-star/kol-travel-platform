import { Badge } from "@/components/ui/Badge";

export function AdminCatalogSafetyBadge({ flags = [] }: { flags?: string[] }) {
  if (flags.length === 0) {
    return <Badge variant="success">Без ограничений</Badge>;
  }

  return <Badge variant="danger">Требует проверки безопасности</Badge>;
}

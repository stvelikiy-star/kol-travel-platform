import { AdminCatalogList } from "@/components/admin/AdminCatalogList";
import type { AdminCatalogItem, AdminCatalogReadResult } from "@/lib/types/admin-catalog";

export function AdminCatalogReviewQueue({
  canModerate,
  result
}: {
  canModerate: boolean;
  result: AdminCatalogReadResult<AdminCatalogItem[]>;
}) {
  return (
    <AdminCatalogList
      canModerate={canModerate}
      description="Защищённая очередь проверки каталога. Главный администратор может одобрять или отклонять позиции на проверке. Публикация выполняется отдельно."
      moderationEnabled
      result={result}
      title="Очередь модерации каталога"
    />
  );
}

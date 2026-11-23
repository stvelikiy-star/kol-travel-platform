import { randomUUID } from "node:crypto";
import { adminCatalogModerationFormAction } from "@/app/actions/admin/adminCatalogModeration";
import { Badge } from "@/components/ui/Badge";
import type { AdminCatalogItem } from "@/lib/types/admin-catalog";

export function AdminCatalogModerationActions({
  canModerate,
  item,
  source
}: {
  canModerate: boolean;
  item: AdminCatalogItem;
  source: "mock" | "supabase" | "fallback";
}) {
  if (source !== "supabase") {
    return (
      <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-muted">
        Модерация отключена: защищённый источник данных не подтверждён.
      </div>
    );
  }

  if (!canModerate) {
    return (
      <div
        className="rounded-md border border-border bg-background p-3 text-sm text-muted"
        data-testid="admin-catalog-read-only-notice"
      >
        Только просмотр. Изменять решения модерации может только главный администратор.
      </div>
    );
  }

  if (item.domain === "categories") {
    return null;
  }

  const isReviewable = item.status === "under_review";
  if (!isReviewable) {
    return <Badge variant="muted">Для текущего статуса нет действий модерации</Badge>;
  }

  const safetyBlocked = (item.safetyFlags?.length ?? 0) > 0;

  return (
    <div className="grid gap-3 rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Решение по модерации</p>
        <Badge variant={safetyBlocked ? "warning" : "success"}>
          {safetyBlocked ? "Одобрение заблокировано проверкой безопасности" : "Изменение главным администратором"}
        </Badge>
      </div>

      {!safetyBlocked ? (
        <ModerationForm action="approve" domain={item.domain} itemId={item.id} />
      ) : null}
      <ModerationForm action="reject" domain={item.domain} itemId={item.id} />
    </div>
  );
}

function ModerationForm({
  action,
  domain,
  itemId
}: {
  action: "approve" | "reject";
  domain: "food" | "tours" | "stays" | "products";
  itemId: string;
}) {
  const requestId = randomUUID();
  const approve = action === "approve";

  return (
    <form action={adminCatalogModerationFormAction} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
      <input name="itemId" type="hidden" value={itemId} />
      <input name="domain" type="hidden" value={domain} />
      <input name="action" type="hidden" value={action} />
      <input name="requestId" type="hidden" value={requestId} />
      <label className="grid gap-1 text-sm font-medium text-foreground">
        {approve ? "Причина одобрения" : "Причина отклонения"}
        <input
          className="min-h-11 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-hidden transition focus:border-primary"
          maxLength={500}
          minLength={3}
          name="reason"
          placeholder={approve ? "Почему позицию можно одобрить" : "Причина отклонения позиции"}
          required
          type="text"
        />
      </label>
      <button
        className={approve
          ? "min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          : "min-h-11 rounded-md border border-danger/40 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger transition hover:bg-danger/15"}
        type="submit"
      >
        {approve ? "Одобрить" : "Отклонить"}
      </button>
    </form>
  );
}

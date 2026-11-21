import { randomUUID } from "node:crypto";
import { partnerPublishInventoryAction } from "@/app/actions/partner/partnerInventoryPublish";
import { Card, CardContent } from "@/components/ui/Card";

type InventoryScope = "room_date" | "tour_schedule";
type InventoryOption = { id: string; title: string };

export function PartnerInventoryPublishForm({
  scopeType, options, enabled
}: {
  scopeType: InventoryScope;
  options: InventoryOption[];
  enabled: boolean;
}) {
  const isRoom = scopeType === "room_date";
  const canPublish = enabled && options.length > 0;
  return (
    <Card className="border-primary/30">
      <CardContent className="space-y-4 p-5">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {isRoom ? "Добавить доступную дату номера" : "Добавить дату и время тура"}
          </h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            Указывайте только подтверждённые даты и количество свободных мест.
            Существующие слоты, брони и остатки эта форма не перезаписывает.
          </p>
        </div>
        {!enabled ? (
          <p className="text-sm font-medium text-muted" role="status">
            Публикация отключена: требуется авторизованная Supabase и проверенная серверная миграция.
          </p>
        ) : null}
        {options.length === 0 ? (
          <p className="text-sm text-muted" role="status">
            Нет активных предложений для публикации. Сначала опубликуйте номер или тур.
          </p>
        ) : null}
        <form action={partnerPublishInventoryAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="scopeType" value={scopeType} />
          <input type="hidden" name="requestId" value={randomUUID()} />
          <label className="grid gap-1 text-sm font-semibold text-foreground">
            {isRoom ? "Номер" : "Тур"}
            <select name="parentId" required disabled={!canPublish}
              className="min-h-11 rounded-md border border-border bg-background px-3 text-foreground">
              {options.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-foreground">
            Дата
            <input type="date" name="date" required disabled={!canPublish}
              className="min-h-11 rounded-md border border-border bg-background px-3 text-foreground" />
          </label>
          {!isRoom ? (
            <label className="grid gap-1 text-sm font-semibold text-foreground">
              Время начала
              <input type="time" name="time" required disabled={!canPublish}
                className="min-h-11 rounded-md border border-border bg-background px-3 text-foreground" />
            </label>
          ) : null}
          <label className="grid gap-1 text-sm font-semibold text-foreground">
            {isRoom ? "Свободных номеров" : "Количество мест"}
            <input type="number" name="capacity" min="1" max="1000" step="1" required disabled={!canPublish}
              className="min-h-11 rounded-md border border-border bg-background px-3 text-foreground" />
          </label>
          {isRoom ? (
            <label className="grid gap-1 text-sm font-semibold text-foreground">
              Особая цена, KGS (необязательно)
              <input type="number" name="priceOverride" min="1" max="10000000" step="0.01"
                disabled={!canPublish}
                className="min-h-11 rounded-md border border-border bg-background px-3 text-foreground" />
            </label>
          ) : null}
          <div className="sm:col-span-2">
            <button type="submit" disabled={!canPublish}
              className="min-h-11 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              Опубликовать подтверждённую доступность
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

import { displayBusinessStatus } from "@/lib/i18n/status-labels";
import { randomUUID } from "node:crypto";
import { partnerCatalogWriteFormAction } from "@/app/actions/partner/partnerCatalogWrite";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import type { PartnerCatalogCategory, PartnerCatalogDomain, PartnerCatalogItem } from "@/lib/types/partner-catalog";

type SharedProps = {
  categories: PartnerCatalogCategory[];
  domain: PartnerCatalogDomain;
};

export function PartnerCatalogCreatePanel({ categories, domain }: SharedProps) {
  if (categories.length === 0) {
    return (
      <Card className="border-warning/40 bg-warning/10">
        <CardHeader>
          <Badge className="w-fit" variant="warning">Изменения заблокированы</Badge>
          <CardTitle>Создание позиции недоступно</CardTitle>
          <CardDescription>Для этого раздела нет подтверждённой категории. Система не создаёт вымышленные категории и не обходит правила каталога.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <Badge className="w-fit" variant="info">Защищённый черновик</Badge>
        <CardTitle>Создать черновик</CardTitle>
        <CardDescription>Новая позиция создаётся только как черновик. Партнёр не может самостоятельно одобрять или публиковать её.</CardDescription>
      </CardHeader>
      <CardContent>
        <CatalogWriteForm categories={categories} domain={domain} action="create" testId="partner-catalog-create-form" />
      </CardContent>
    </Card>
  );
}

export function PartnerCatalogItemWritePanel({
  categories,
  domain,
  item
}: SharedProps & { item: PartnerCatalogItem }) {
  const editable = item.status === "draft" || item.status === "rejected";
  const submittable = item.status === "draft";

  if (!editable && !submittable) {
    return (
      <div className="rounded-md border border-border bg-background p-3 text-sm text-muted">
        Редактирование заблокировано для статуса <strong className="text-foreground">{displayBusinessStatus(item.status)}</strong>. После отправки на модерацию партнёр не может изменить запись до следующего разрешённого этапа.
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-border pt-4">
      {editable ? (
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-primary">Редактировать черновик</summary>
          <div className="mt-3">
            <CatalogWriteForm
              categories={categories}
              domain={domain}
              action="update"
              item={item}
              testId={`partner-catalog-update-form-${item.id}`}
            />
          </div>
        </details>
      ) : null}
      {submittable ? (
        <form action={partnerCatalogWriteFormAction} data-testid={`partner-catalog-submit-form-${item.id}`}>
          <input name="domain" type="hidden" value={domain} />
          <input name="action" type="hidden" value="submit" />
          <input name="itemId" type="hidden" value={item.id} />
          <input name="requestId" type="hidden" value={`partner-catalog-submit-${randomUUID()}`} />
          <Button type="submit" variant="secondary">Отправить на модерацию</Button>
        </form>
      ) : null}
    </div>
  );
}

function CatalogWriteForm({
  action,
  categories,
  domain,
  item,
  testId
}: SharedProps & {
  action: "create" | "update";
  item?: PartnerCatalogItem;
  testId: string;
}) {
  return (
    <form action={partnerCatalogWriteFormAction} className="grid gap-3 md:grid-cols-2" data-testid={testId}>
      <input name="domain" type="hidden" value={domain} />
      <input name="action" type="hidden" value={action} />
      <input name="itemId" type="hidden" value={item?.id ?? ""} />
      <input name="requestId" type="hidden" value={`partner-catalog-${action}-${randomUUID()}`} />

      <Field label="Категория">
        <select
          className="min-h-11 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
          defaultValue={item?.categoryId ?? categories[0]?.id}
          name="categoryId"
          required
        >
          {categories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}
        </select>
      </Field>
      <Field label="Название"><Input defaultValue={item?.title ?? ""} maxLength={160} name="title" required /></Field>
      <Field label="Цена в сомах"><Input defaultValue={item?.price ?? ""} min="0" name="price" required step="0.01" type="number" /></Field>

      {domain === "tours" || domain === "stays" ? (
        <>
          <Field label="Адрес страницы (латиницей)"><Input defaultValue={item?.slug ?? ""} maxLength={120} name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" required /></Field>
          <Field label="Локация"><Input defaultValue={item?.location ?? ""} maxLength={200} name="location" required /></Field>
        </>
      ) : null}
      {domain === "tours" ? <Field label="Длительность"><Input defaultValue={item?.type ?? ""} maxLength={100} name="duration" /></Field> : null}
      {domain === "stays" ? <Field label="Тип размещения"><Input defaultValue={item?.type ?? ""} maxLength={100} name="type" /></Field> : null}
      {domain === "food" ? <Field label="Приготовление, минут"><Input defaultValue={item?.preparationTimeMinutes ?? ""} max="1440" min="1" name="preparationTimeMinutes" type="number" /></Field> : null}
      {domain === "products" ? <Field label="Остаток"><Input defaultValue={item?.stockQty ?? 0} max="1000000" min="0" name="stockQty" required type="number" /></Field> : null}

      <label className="grid gap-2 text-sm font-semibold md:col-span-2" htmlFor="catalog-description">
        <span>Описание</span>
        <Textarea defaultValue={item?.description === "No description" ? "" : item?.description ?? ""} id="catalog-description" maxLength={2000} name="description" />
      </label>
      <div className="md:col-span-2">
        <Button type="submit">{action === "create" ? "Создать черновик" : "Сохранить черновик"}</Button>
      </div>
    </form>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return <label className="grid gap-2 text-sm font-semibold">{label}{children}</label>;
}

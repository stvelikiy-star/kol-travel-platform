import { displayBusinessStatus, displayOrderType } from "@/lib/i18n/status-labels";
import { randomUUID } from "node:crypto";
import { adminCatalogCategoryFormAction } from "@/app/actions/admin/adminCatalogCategories";
import { AdminCatalogEmptyState } from "@/components/admin/AdminCatalogEmptyState";
import { AdminCatalogModeBadge } from "@/components/admin/AdminCatalogModeBadge";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import type { AdminCatalogCategoryView, AdminCatalogReadResult } from "@/lib/types/admin-catalog";

const scopes = ["food", "tour", "stay", "shop"] as const;

export function AdminCatalogCategories({
  canGovern = false,
  result
}: {
  canGovern?: boolean;
  result: AdminCatalogReadResult<AdminCatalogCategoryView[]>;
}) {
  const writeEnabled = canGovern && result.source === "supabase";
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Категории каталога</CardTitle>
              <CardDescription>
                Управление категориями доступно только главному администратору через защищённые серверные операции с журналом действий. Ограниченные товары не допускаются.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <AdminCatalogModeBadge mode={result.mode} />
              <Badge variant={writeEnabled ? "success" : "info"}>
                {writeEnabled ? "Изменение категорий разрешено" : "Только просмотр"}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {writeEnabled ? <CreateCategoryForm categories={result.items} /> : null}

      {result.items.length === 0 ? (
        <AdminCatalogEmptyState label="Категории не найдены" />
      ) : (
        <div className="grid gap-3">
          {result.items.map((category) => (
            <Card key={category.id}>
              <CardContent className="space-y-4 p-5">
                <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-6">
                  <Field label="Название" value={category.title} />
                  <Field label="Адрес страницы (латиницей)" value={category.slug ?? "Не указано"} />
                  <Field label="Раздел" value={category.scope ? displayOrderType(category.scope) : "Не указано"} />
                  <Field label="Родительская категория" value={category.parentId ?? "Нет"} />
                  <Field label="Порядок" value={String(category.sortOrder ?? "Не указано")} />
                  <Field label="Статус" value={displayBusinessStatus(category.status ?? "active")} />
                </div>
                {writeEnabled && (category.status ?? "active") === "active" ? (
                  <div className="grid gap-4 xl:grid-cols-2">
                    <UpdateCategoryForm category={category} categories={result.items} />
                    <ArchiveCategoryForm category={category} />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateCategoryForm({ categories }: { categories: AdminCatalogCategoryView[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Создать категорию</CardTitle>
        <CardDescription>Создаёт только активную категорию. Названия, связанные с товарами с ограничениями, блокируются.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={adminCatalogCategoryFormAction} className="grid gap-3 lg:grid-cols-3" data-testid="admin-category-create-form">
          <input name="action" type="hidden" value="create" />
          <input name="categoryId" type="hidden" value="" />
          <input name="requestId" type="hidden" value={randomUUID()} />
          <TextField label="Название" name="title" placeholder="Экскурсии" />
          <TextField label="Адрес страницы (латиницей)" name="slug" placeholder="excursions" />
          <ScopeField />
          <ParentField categories={categories} currentId={null} selected="" />
          <TextField defaultValue="0" label="Порядок отображения" name="sortOrder" placeholder="0" type="number" />
          <TextField label="Причина изменения" name="reason" placeholder="Основание создания категории" />
          <button className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white" type="submit">
            Создать категорию
          </button>
        </form>
      </CardContent>
    </Card>
  );
}

function UpdateCategoryForm({
  category,
  categories
}: {
  category: AdminCatalogCategoryView;
  categories: AdminCatalogCategoryView[];
}) {
  return (
    <form action={adminCatalogCategoryFormAction} className="grid gap-3 rounded-lg border border-border bg-background p-4" data-testid={`admin-category-update-${category.id}`}>
      <p className="font-semibold text-foreground">Редактировать активную категорию</p>
      <input name="action" type="hidden" value="update" />
      <input name="categoryId" type="hidden" value={category.id} />
      <input name="requestId" type="hidden" value={randomUUID()} />
      <TextField defaultValue={category.title} label="Название" name="title" />
      <TextField defaultValue={category.slug ?? ""} label="Адрес страницы (латиницей)" name="slug" />
      <ScopeField selected={category.scope ?? "food"} />
      <ParentField categories={categories} currentId={category.id} selected={category.parentId ?? ""} />
      <TextField defaultValue={String(category.sortOrder ?? 0)} label="Порядок отображения" name="sortOrder" type="number" />
      <TextField label="Причина изменения" name="reason" placeholder="Основание изменения категории" />
      <button className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white" type="submit">
        Сохранить категорию
      </button>
    </form>
  );
}

function ArchiveCategoryForm({ category }: { category: AdminCatalogCategoryView }) {
  return (
    <form action={adminCatalogCategoryFormAction} className="grid gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4" data-testid={`admin-category-archive-${category.id}`}>
      <p className="font-semibold text-foreground">Архивировать категорию</p>
      <p className="text-sm leading-6 text-muted">
        Нельзя архивировать категорию, пока с ней связаны активные подкатегории или позиции каталога.
      </p>
      <input name="action" type="hidden" value="archive" />
      <input name="categoryId" type="hidden" value={category.id} />
      <input name="requestId" type="hidden" value={randomUUID()} />
      <TextField label="Причина изменения" name="reason" placeholder="Причина архивации категории" />
      <button className="min-h-11 rounded-md border border-danger/40 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger" type="submit">
        Архивировать категорию
      </button>
    </form>
  );
}

function ScopeField({ selected = "food" }: { selected?: string }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-foreground">
      Раздел
      <select className="min-h-11 rounded-md border border-border bg-surface px-3 py-2" defaultValue={selected} name="scope">
        {scopes.map((scope) => <option key={scope} value={scope}>{displayOrderType(scope)}</option>)}
      </select>
    </label>
  );
}

function ParentField({
  categories,
  currentId,
  selected
}: {
  categories: AdminCatalogCategoryView[];
  currentId: string | null;
  selected: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-foreground">
      Родительская категория
      <select className="min-h-11 rounded-md border border-border bg-surface px-3 py-2" defaultValue={selected} name="parentId">
        <option value="">Без родительской категории</option>
        {categories
          .filter((entry) => entry.id !== currentId && (entry.status ?? "active") === "active")
          .map((entry) => <option key={entry.id} value={entry.id}>{displayOrderType(entry.scope)}: {entry.title}</option>)}
      </select>
    </label>
  );
}

function TextField({
  defaultValue,
  label,
  name,
  placeholder,
  type = "text"
}: {
  defaultValue?: string;
  label: string;
  name: string;
  placeholder?: string;
  type?: "text" | "number";
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-foreground">
      {label}
      <input
        className="min-h-11 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-hidden transition focus:border-primary"
        defaultValue={defaultValue}
        maxLength={type === "text" ? 500 : undefined}
        minLength={name === "reason" ? 3 : undefined}
        name={name}
        placeholder={placeholder}
        required={name !== "parentId"}
        type={type}
      />
    </label>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 wrap-break-word font-medium text-foreground">{value}</p>
    </div>
  );
}

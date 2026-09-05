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
              <CardTitle>Catalog categories</CardTitle>
              <CardDescription>
                Canonical taxonomy governance. Super-admin writes are RPC-only, audited and alcohol fail-closed.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <AdminCatalogModeBadge mode={result.mode} />
              <Badge variant={writeEnabled ? "success" : "info"}>
                {writeEnabled ? "Super-admin category governance enabled" : "Read-only admin view"}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {writeEnabled ? <CreateCategoryForm categories={result.items} /> : null}

      {result.items.length === 0 ? (
        <AdminCatalogEmptyState label="No categories found." />
      ) : (
        <div className="grid gap-3">
          {result.items.map((category) => (
            <Card key={category.id}>
              <CardContent className="space-y-4 p-5">
                <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-6">
                  <Field label="Title" value={category.title} />
                  <Field label="Slug" value={category.slug ?? "n/a"} />
                  <Field label="Scope" value={category.scope ?? "n/a"} />
                  <Field label="Parent" value={category.parentId ?? "none"} />
                  <Field label="Sort" value={String(category.sortOrder ?? "n/a")} />
                  <Field label="Status" value={category.status ?? "active"} />
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
        <CardTitle>Create category</CardTitle>
        <CardDescription>Creates only an active canonical category; alcohol-like names/slugs are blocked.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={adminCatalogCategoryFormAction} className="grid gap-3 lg:grid-cols-3" data-testid="admin-category-create-form">
          <input name="action" type="hidden" value="create" />
          <input name="categoryId" type="hidden" value="" />
          <input name="requestId" type="hidden" value={randomUUID()} />
          <TextField label="Title" name="title" placeholder="Excursions" />
          <TextField label="Slug" name="slug" placeholder="excursions" />
          <ScopeField />
          <ParentField categories={categories} currentId={null} selected="" />
          <TextField defaultValue="0" label="Sort order" name="sortOrder" placeholder="0" type="number" />
          <TextField label="Audit reason" name="reason" placeholder="Create canonical category" />
          <button className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white" type="submit">
            Create category
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
      <p className="font-semibold text-foreground">Edit active category</p>
      <input name="action" type="hidden" value="update" />
      <input name="categoryId" type="hidden" value={category.id} />
      <input name="requestId" type="hidden" value={randomUUID()} />
      <TextField defaultValue={category.title} label="Title" name="title" />
      <TextField defaultValue={category.slug ?? ""} label="Slug" name="slug" />
      <ScopeField selected={category.scope ?? "food"} />
      <ParentField categories={categories} currentId={category.id} selected={category.parentId ?? ""} />
      <TextField defaultValue={String(category.sortOrder ?? 0)} label="Sort order" name="sortOrder" type="number" />
      <TextField label="Audit reason" name="reason" placeholder="Update taxonomy metadata" />
      <button className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white" type="submit">
        Save category
      </button>
    </form>
  );
}

function ArchiveCategoryForm({ category }: { category: AdminCatalogCategoryView }) {
  return (
    <form action={adminCatalogCategoryFormAction} className="grid gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4" data-testid={`admin-category-archive-${category.id}`}>
      <p className="font-semibold text-foreground">Archive category</p>
      <p className="text-sm leading-6 text-muted">
        Archive is rejected while active children or any non-archived catalog item still references this category.
      </p>
      <input name="action" type="hidden" value="archive" />
      <input name="categoryId" type="hidden" value={category.id} />
      <input name="requestId" type="hidden" value={randomUUID()} />
      <TextField label="Audit reason" name="reason" placeholder="Why this category must be archived" />
      <button className="min-h-11 rounded-md border border-danger/40 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger" type="submit">
        Archive category
      </button>
    </form>
  );
}

function ScopeField({ selected = "food" }: { selected?: string }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-foreground">
      Scope
      <select className="min-h-11 rounded-md border border-border bg-surface px-3 py-2" defaultValue={selected} name="scope">
        {scopes.map((scope) => <option key={scope} value={scope}>{scope}</option>)}
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
      Parent
      <select className="min-h-11 rounded-md border border-border bg-surface px-3 py-2" defaultValue={selected} name="parentId">
        <option value="">No parent</option>
        {categories
          .filter((entry) => entry.id !== currentId && (entry.status ?? "active") === "active")
          .map((entry) => <option key={entry.id} value={entry.id}>{entry.scope}: {entry.title}</option>)}
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
        className="min-h-11 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
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
      <p className="mt-1 break-words font-medium text-foreground">{value}</p>
    </div>
  );
}

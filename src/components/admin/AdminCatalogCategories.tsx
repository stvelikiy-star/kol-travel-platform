import { AdminCatalogEmptyState } from "@/components/admin/AdminCatalogEmptyState";
import { AdminCatalogModeBadge } from "@/components/admin/AdminCatalogModeBadge";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import type { AdminCatalogCategoryView, AdminCatalogReadResult } from "@/lib/types/admin-catalog";

export function AdminCatalogCategories({ result }: { result: AdminCatalogReadResult<AdminCatalogCategoryView[]> }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Catalog categories</CardTitle>
              <CardDescription>Read-only category visibility for moderation planning.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <AdminCatalogModeBadge mode={result.mode} />
              <Badge variant="info">Read-only admin view</Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {result.items.length === 0 ? (
        <AdminCatalogEmptyState label="No categories found." />
      ) : (
        <div className="grid gap-3">
          {result.items.map((category) => (
            <Card key={category.id}>
              <CardContent className="grid gap-2 p-5 text-sm sm:grid-cols-2 lg:grid-cols-5">
                <Field label="Title" value={category.title} />
                <Field label="Slug" value={category.slug ?? "n/a"} />
                <Field label="Scope" value={category.scope ?? "n/a"} />
                <Field label="Parent" value={category.parentId ?? "none"} />
                <Field label="Sort" value={String(category.sortOrder ?? "n/a")} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
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

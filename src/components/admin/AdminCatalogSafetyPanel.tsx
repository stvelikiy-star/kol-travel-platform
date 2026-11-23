import { AdminCatalogEmptyState } from "@/components/admin/AdminCatalogEmptyState";
import { AdminCatalogModeBadge } from "@/components/admin/AdminCatalogModeBadge";
import { AdminCatalogStatusBadge } from "@/components/admin/AdminCatalogStatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import type { AdminCatalogReadResult, AdminCatalogSafetyFlag } from "@/lib/types/admin-catalog";

const severityLabels: Record<string, string> = { low: "Низкий риск", medium: "Средний риск", high: "Высокий риск", critical: "Критический риск" };
function displaySafetySeverity(status: string) { return severityLabels[status] ?? "Требует проверки"; }
export function AdminCatalogSafetyPanel({ result }: { result: AdminCatalogReadResult<AdminCatalogSafetyFlag[]> }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Сигналы безопасности каталога</CardTitle>
              <CardDescription>Просмотр проверки безопасности товаров. Продажа алкоголя отключена.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <AdminCatalogModeBadge mode={result.mode} />
              <Badge variant="danger">Продажа алкоголя отключена</Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {result.items.length === 0 ? (
        <AdminCatalogEmptyState label="Сигналов безопасности не обнаружено" />
      ) : (
        <div className="grid gap-3">
          {result.items.map((flag) => (
            <Card key={`${flag.domain}-${flag.itemId}-${flag.reason}`}>
              <CardContent className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{flag.title}</p>
                    <p className="text-sm text-muted">{flag.businessTitle ?? "Бизнес"} - {flag.businessId ?? "Не указано"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={flag.severity === "critical" ? "danger" : "warning"}>{displaySafetySeverity(flag.severity)}</Badge>
                    <AdminCatalogStatusBadge status={flag.status} />
                  </div>
                </div>
                <p className="text-sm text-muted">{flag.reason}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

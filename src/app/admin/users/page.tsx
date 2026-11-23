import { displayBusinessStatus } from "@/lib/i18n/status-labels";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { getAdminUserDirectoryReadResult } from "@/lib/data/admin-user-directory-supabase";

export const dynamic = "force-dynamic";

type Params = { q?: string | string[] };

export default async function AdminUsersPage({ searchParams }: { searchParams?: Promise<Params> }) {
  const params = await searchParams;
  const raw = Array.isArray(params?.q) ? params?.q[0] : params?.q;
  const q = typeof raw === "string" ? raw : "";
  const result = await getAdminUserDirectoryReadResult(q);

  return (
    <AdminLayout status={result.ok ? "stable" : "attention"}>
      <Card className="overflow-hidden">
        <div className="bg-linear-to-br from-slate-900 via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">KÖL · Пользователи</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Пользователи</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Реальные профили платформы. Доступ разрешён только владельцу платформы.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Поиск по электронной почте</CardTitle>
          <CardDescription>Показываются только записи из рабочей базы, не более 50 за один запрос.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form action="/admin/users" method="get" className="flex max-w-2xl flex-wrap gap-2">
            <Input className="flex-1" type="search" name="q" defaultValue={q.slice(0, 64)}
              aria-label="Поиск пользователя по электронной почте" placeholder="Поиск по электронной почте" maxLength={64} />
            <Button type="submit">Найти</Button>
          </form>
          {!result.ok ? (
            <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm font-medium" role="status">
              {result.reason === "invalid_query" ? "Недопустимый поисковый запрос." :
                result.reason === "not_authorized" ? "Требуется учётная запись владельца платформы." :
                "Каталог пользователей временно недоступен: без подтверждённого доступа KÖL не показывает личные данные."}
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted">Найдено профилей: {result.total}. Показано: {result.items.length}.</p>
              {result.items.length === 0 ? <p className="text-sm text-muted">Совпадений нет.</p> :
                result.items.map(user => (
                  <article key={user.user_id} className="grid gap-2 rounded-md border border-border bg-background p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="min-w-0">
                      <p className="break-words font-semibold">{user.full_name || user.email || "Без имени"}</p>
                      <p className="break-words text-sm text-muted">{user.email || "Email не указан"}</p>
                      <p className="mt-1 break-all text-xs text-muted">ID: {user.user_id}</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:items-end">
                      <Badge variant={user.status === "active" ? "success" : "warning"}>{displayBusinessStatus(user.status)}</Badge>
                      <span className="text-xs text-muted">{new Date(user.created_at).toLocaleDateString("ru-RU")}</span>
                    </div>
                  </article>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-lake-light">
        <CardHeader><CardTitle>Администрирование прав</CardTitle></CardHeader>
        <CardContent className="text-sm leading-6 text-muted">
          Профили доступны только после проверки прав на сервере. Изменение ролей, блокировка и разблокировка остаются отключены,
          пока эти операции не получат отдельный серверный аудит и подтверждение полномочий.
          Справочник не создаёт пользователей и не меняет их данные.
        </CardContent>
      </Card>
    </AdminLayout>
  );
}

import Link from "next/link";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getAdminRoleDirectoryReadResult } from "@/lib/data/admin-role-directory-supabase";

export const dynamic = "force-dynamic";

export default async function AdminClientsPage() {
  const result = await getAdminRoleDirectoryReadResult("client");
  return (
    <AdminLayout status={result.ok ? "stable" : "attention"}>
      <Card className="overflow-hidden">
        <div className="bg-linear-to-br from-slate-900 via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">KÖL · Client Directory</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Клиенты</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Реальные клиентские профили из PostgreSQL. Доступ ограничен владельцем платформы.
          </p>
        </div>
      </Card>
      <Card>
        <CardHeader><CardTitle>Зарегистрированные клиенты</CardTitle>
          <CardDescription>Список авторизованного контура Supabase; без демонстрационных контактов или баллов лояльности.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {!result.ok ? <p className="text-sm text-danger" role="status">Клиентский справочник недоступен. Личные данные не подменяются mock-значениями.</p> :
          <>
            <p className="text-sm text-muted">Клиентов: {result.total}. Показано: {result.items.length}.</p>
            {result.items.length === 0 ? <p className="text-sm text-muted">Пока нет зарегистрированных клиентских профилей.</p> :
            result.items.map(client => <article key={client.userId} className="rounded-md border border-border bg-background p-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="font-semibold">{client.fullName ?? "Имя не указано"}</p>
                  <p className="text-sm text-muted">{client.email ?? "Email не указан"}</p>
                  <p className="mt-1 break-all text-xs text-muted">ID: {client.userId}</p>
                </div>
                <Badge variant={client.status === "active" ? "success" : "warning"}>{client.status}</Badge>
              </div>
            </article>)}
          </>}
        </CardContent>
      </Card>
      <Card className="border-primary/20 bg-lake-light">
        <CardHeader><CardTitle>Заказы, бронирования и поддержка</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3 text-sm">
          <Link href="/admin/orders" className="rounded-md border border-primary px-4 py-2 font-semibold text-primary">Заказы</Link>
          <Link href="/admin/bookings" className="rounded-md border border-primary px-4 py-2 font-semibold text-primary">Бронирования</Link>
          <Link href="/admin/support" className="rounded-md border border-primary px-4 py-2 font-semibold text-primary">Поддержка</Link>
          <p className="w-full text-muted">Действия над клиентскими профилями не выполняются без отдельного аудируемого backend-контракта.</p>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}

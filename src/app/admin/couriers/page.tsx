import Link from "next/link";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getAdminRoleDirectoryReadResult } from "@/lib/data/admin-role-directory-supabase";
import { displayBusinessStatus } from "@/lib/i18n/status-labels";

export const dynamic = "force-dynamic";

export default async function AdminCouriersPage() {
  const result = await getAdminRoleDirectoryReadResult("courier");
  return (
    <AdminLayout status={result.ok ? "stable" : "attention"}>
      <Card className="overflow-hidden">
        <div className="bg-linear-to-br from-slate-900 via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">KÖL · Справочник курьеров</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Курьеры</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Реальные профили, транспорт и доступность курьеров из PostgreSQL. Никаких вымышленных смен или назначений.
          </p>
        </div>
      </Card>
      <Card>
        <CardHeader><CardTitle>Курьеры платформы</CardTitle>
          <CardDescription>Справочник доступен только главному администратору после серверной проверки прав.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {!result.ok ? <p className="text-sm text-danger" role="status">Курьерский справочник недоступен. Источник данных не подтверждён.</p> :
          <>
            <p className="text-sm text-muted">Курьеров: {result.total}. Показано: {result.items.length}.</p>
            {result.items.length === 0 ? <p className="text-sm text-muted">Пока нет зарегистрированных курьеров.</p> :
            result.items.map(courier => <article key={courier.userId} className="rounded-md border border-border bg-background p-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="font-semibold">{courier.fullName ?? "Имя не указано"}</p>
                  <p className="text-sm text-muted">{courier.email ?? "Электронная почта не указана"}</p>
                  <p className="mt-1 break-all text-xs text-muted">ID: {courier.userId}</p>
                </div>
                <Badge variant={courier.availabilityStatus === "online" ? "success" : "muted"}>{displayBusinessStatus(courier.availabilityStatus)}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted">Зона: {courier.workingZone ?? "Не указана"} · Транспорт: {courier.vehicleType ?? "Не указан"} · Номер: {courier.vehicleNumber ?? "Не указан"}</p>
            </article>)}
          </>}
        </CardContent>
      </Card>
      <Card className="border-primary/20 bg-lake-light">
        <CardHeader><CardTitle>Назначения и статусы доставок</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted">Изменение назначений выполняется в рабочем разделе через защищённую серверную операцию.</p>
          <Link href="/admin/delivery" className="inline-flex rounded-md border border-primary px-4 py-2 font-semibold text-primary">Открыть управление доставкой</Link>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}

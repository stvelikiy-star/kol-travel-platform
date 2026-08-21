import type { ReactNode } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

const courierAreas = ["Статус смены", "Активное назначение", "История доставок", "Проблемы / риск"];

export default function AdminCouriersPage() {
  return (
    <AdminLayout status="attention">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Courier directory locked</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Курьеры</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Административный список курьеров не подставляет вымышленные имена, телефоны, транспорт, статусы смен или назначения. Эти данные должны поступать из защищённого courier/read-контура.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium leading-6 text-foreground">
          Назначение доставки, пауза смены и изменение courier status отключены, пока нет подтверждённой серверной операции с ролью администратора и audit log.
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {courierAreas.map((area) => (
          <Card key={area}>
            <CardContent className="space-y-3 p-5">
              <p className="text-sm font-semibold text-foreground">{area}</p>
              <Badge variant="muted">Не подтверждено</Badge>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Контракт courier management</CardTitle>
            <CardDescription>Операционные данные курьера должны быть авторизованы и привязаны к реальным назначениям.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Requirement>Courier profile и status читаются через защищённый server-side reader.</Requirement>
            <Requirement>Назначение доставки выполняется только атомарной серверной операцией.</Requirement>
            <Requirement>Риск строится из фактического delivery state, а не из UI-позиции или mock-списка.</Requirement>
            <Requirement>Геолокация не показывается без отдельного разрешённого контура.</Requirement>
          </CardContent>
        </Card>

        <Card className="border-danger/30 bg-danger/10">
          <CardHeader>
            <CardTitle>Управляющие действия отключены</CardTitle>
            <CardDescription>Admin UI не назначает доставку, не меняет смену и не блокирует курьера без подтверждённого backend contract.</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="danger">Нет fake courier actions</Badge>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function Requirement({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-border bg-background p-3 text-sm font-medium text-foreground">{children}</div>;
}

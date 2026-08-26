import type { ReactNode } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

const clientAreas = ["Профили", "Заказы клиента", "Бронирования", "Loyalty / поддержка"];

export default function AdminClientsPage() {
  return (
    <AdminLayout status="attention">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Client directory locked</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Клиенты</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Персональные профили клиентов не подменяются demo-именами, телефонами, email, баллами или агрегатами. Реальный список требует защищённого административного read-контура.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium leading-6 text-foreground">
          Пока client-directory reader не подтверждён, количество клиентов и персональные показатели отображаются как недоступные, а не как фиктивные значения.
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {clientAreas.map((area) => (
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
            <CardTitle>Контракт клиентских данных</CardTitle>
            <CardDescription>Admin должен видеть только необходимые данные и только после server-side authorization.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Requirement>Client profile читается по защищённой административной политике.</Requirement>
            <Requirement>Заказы и брони связываются с клиентом серверными идентификаторами.</Requirement>
            <Requirement>Loyalty нельзя вычислять из условных баллов в UI.</Requirement>
            <Requirement>Недоступность данных не заменяется mock-профилем.</Requirement>
          </CardContent>
        </Card>

        <Card className="border-danger/30 bg-danger/10">
          <CardHeader>
            <CardTitle>Персональные действия отключены</CardTitle>
            <CardDescription>Профиль, поддержка и изменения клиентских данных требуют отдельного server action и audit log.</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="danger">Нет fake client actions</Badge>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function Requirement({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-border bg-background p-3 text-sm font-medium text-foreground">{children}</div>;
}

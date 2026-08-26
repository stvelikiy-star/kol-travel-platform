import type { ReactNode } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

const moderationAreas = ["Партнёры", "Каталог", "Отзывы / жалобы", "Stop / abuse signals"];

export default function AdminModerationPage() {
  return (
    <AdminLayout status="attention">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Moderation locked</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Модерация</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Очередь модерации не подменяется фиктивными партнёрами, жалобами, рисками или количеством задач. Только подтверждённые moderation records могут появляться на этом экране.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium leading-6 text-foreground">
          Одобрение, отклонение, скрытие и отправка на доработку отключены до появления серверной moderation queue, проверки admin role и audit log.
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {moderationAreas.map((area) => (
          <Card key={area}>
            <CardContent className="space-y-3 p-5">
              <p className="text-sm font-semibold text-foreground">{area}</p>
              <Badge variant="muted">Очередь не подключена</Badge>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Контракт moderation queue</CardTitle>
            <CardDescription>Каждый элемент очереди должен иметь реальный источник и историю решения.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Requirement>Источник: partner/catalog/review/complaint/security event.</Requirement>
            <Requirement>Статус и риск поступают из серверной записи, а не вычисляются UI.</Requirement>
            <Requirement>Решение модератора фиксируется с actor, временем и причиной.</Requirement>
            <Requirement>Повторное действие должно быть идемпотентным или явно конфликтовать.</Requirement>
          </CardContent>
        </Card>

        <Card className="border-danger/30 bg-danger/10">
          <CardHeader>
            <CardTitle>Moderation actions отключены</CardTitle>
            <CardDescription>До backend-контракта интерфейс не меняет публичность партнёра, каталога, отзыва или жалобы.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge variant="danger">Нет fake moderation actions</Badge>
            <p className="text-sm leading-6 text-muted">Alcohol module остаётся выключенным независимо от состояния этого экрана.</p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function Requirement({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-border bg-background p-3 text-sm font-medium text-foreground">{children}</div>;
}

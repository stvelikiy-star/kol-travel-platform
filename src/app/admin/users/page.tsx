import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

const roleScopes = ["Клиенты", "Партнёры", "Курьеры", "Администраторы"];

export default function AdminUsersPage() {
  return (
    <AdminLayout status="attention">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">User directory locked</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Пользователи</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Каталог пользователей не показывает вымышленные профили, контакты, роли или активность. Реальные данные появятся только из авторизованного directory/RLS-контура.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium leading-6 text-foreground">
          Поиск, блокировка и изменение ролей отключены до подключения подтверждённого user directory, серверной проверки прав и audit log.
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {roleScopes.map((role) => (
          <Card key={role}>
            <CardContent className="space-y-3 p-5">
              <p className="text-sm font-semibold text-foreground">{role}</p>
              <Badge variant="muted">Количество не подтверждено</Badge>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Что требуется для чтения</CardTitle>
            <CardDescription>Персональные данные нельзя подменять preview-значениями.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Requirement>Активная административная роль и server-side auth.</Requirement>
            <Requirement>RLS-политики для профилей и ролей.</Requirement>
            <Requirement>Минимально необходимый набор персональных полей.</Requirement>
            <Requirement>Fail-closed поведение при недоступности профилей.</Requirement>
          </CardContent>
        </Card>

        <Card className="border-danger/30 bg-danger/10">
          <CardHeader>
            <CardTitle>Изменения доступа отключены</CardTitle>
            <CardDescription>Блокировка, смена роли и ручное редактирование профиля требуют серверной операции и audit log.</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="danger">Нет неподтверждённых admin actions</Badge>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function Requirement({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-border bg-background p-3 font-medium text-foreground">{children}</div>;
}

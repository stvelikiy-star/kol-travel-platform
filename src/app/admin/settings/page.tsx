import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

const safetyRules = [
  "Рабочий режим включается только после проверки релиза и отдельного подтверждения.",
  "Алкогольный модуль остаётся отключённым.",
  "Выплаты и возвраты нельзя включать через этот экран.",
  "Внешние интеграции требуют серверной настройки и аудита."
];

const settingsRequirements = [
  "Список параметров, которые разрешено изменять.",
  "Проверка роли пользователя и журнал каждого изменения.",
  "Раздельное хранение настроек, секретных ключей и предпочтений пользователей.",
  "Проверка изменений и возможность отмены критических операций."
];

export default function AdminSettingsPage() {
  return (
    <AdminLayout status="attention">
      <Card className="overflow-hidden">
        <div className="bg-linear-to-br from-lake-dark via-primary to-sand p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Системные настройки защищены</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Настройки платформы</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Критические параметры изменяются только на сервере. Этот экран не показывает фиктивные переключатели и не имитирует сохранение настроек.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardHeader>
          <CardTitle>Редактирование системных настроек пока недоступно</CardTitle>
          <CardDescription>
            Для изменения параметров необходим защищённый серверный механизм. Это ограничение не мешает работе каталога, заявок и личных кабинетов.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Что необходимо для управления настройками</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {settingsRequirements.map((rule) => <Requirement key={rule}>{rule}</Requirement>)}
          </CardContent>
        </Card>

        <Card className="border-danger/30 bg-danger/10">
          <CardHeader><CardTitle>Правила безопасности</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {safetyRules.map((rule) => <Requirement key={rule}>{rule}</Requirement>)}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function Requirement({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-border bg-background p-3 font-medium text-foreground">{children}</div>;
}

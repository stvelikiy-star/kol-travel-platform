import { CourierLayout } from "@/components/layout/CourierLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

export default function CourierProfilePage() {
  return (
    <CourierLayout status="online">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Courier profile locked</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Профиль курьера</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Профиль не показывает вымышленные имя, телефон, транспорт, номер машины, смену или настройки уведомлений.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium leading-6 text-foreground">
          Просмотр и редактирование профиля отключены до подключения authenticated courier profile reader, RLS, server-side update и audit log.
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Данные профиля</CardTitle>
            <CardDescription>Минимальный production-контур должен читать только профиль текущего courier user.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Requirement>Имя и контакт — только из authenticated profile.</Requirement>
            <Requirement>Тип транспорта и рабочая зона — только подтверждённые значения.</Requirement>
            <Requirement>Документы и verification status — отдельный защищённый контур.</Requirement>
            <Requirement>GPS и location permissions — отдельное явное разрешение.</Requirement>
          </CardContent>
        </Card>

        <Card className="border-danger/30 bg-danger/10">
          <CardHeader>
            <CardTitle>Изменения профиля пока закрыты</CardTitle>
            <CardDescription>Нет fake Save, shift settings или notification toggles.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Requirement>Любой update должен проверять courier ownership.</Requirement>
            <Requirement>Изменения статуса смены должны быть отдельной серверной операцией.</Requirement>
            <Requirement>Чувствительные поля не обновляются из общего client UI.</Requirement>
            <Requirement>Audit trail обязателен для административно значимых изменений.</Requirement>
          </CardContent>
        </Card>
      </div>
    </CourierLayout>
  );
}

function Requirement({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-border bg-background p-3 font-medium text-foreground">{children}</div>;
}

import { CourierLayout } from "@/components/layout/CourierLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

export default function CourierProfilePage() {
  return (
    <CourierLayout status="online">
      <a href="/account/security" className="inline-flex min-h-11 items-center rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-lake-light">
        Изменить email (логин) или пароль →
      </a>
      <Card className="overflow-hidden">
        <div className="bg-linear-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Courier profile locked</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Профиль курьера</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Профиль не показывает вымышленные имя, телефон, транспорт, номер машины, смену или настройки уведомлений.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium leading-6 text-foreground">
          Профиль пока недоступен для просмотра и изменения: необходимы защищённая загрузка данных курьера, проверка прав, серверное сохранение и журнал действий.
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Данные профиля</CardTitle>
            <CardDescription>Рабочий режим должен загружать только профиль текущего курьера.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Requirement>Имя и контакты — только из подтверждённого профиля.</Requirement>
            <Requirement>Тип транспорта и рабочая зона — только подтверждённые значения.</Requirement>
            <Requirement>Документы и статус проверки обрабатываются отдельно в защищённом разделе.</Requirement>
            <Requirement>Доступ к геолокации предоставляется только с отдельного согласия.</Requirement>
          </CardContent>
        </Card>

        <Card className="border-danger/30 bg-danger/10">
          <CardHeader>
            <CardTitle>Изменения профиля пока закрыты</CardTitle>
            <CardDescription>Нет фиктивного сохранения, настроек смен или уведомлений.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Requirement>Любое изменение должно проверять права текущего курьера.</Requirement>
            <Requirement>Изменения статуса смены должны быть отдельной серверной операцией.</Requirement>
            <Requirement>Секретные данные не изменяются через общий клиентский интерфейс.</Requirement>
            <Requirement>Для важных изменений обязателен журнал действий.</Requirement>
          </CardContent>
        </Card>
      </div>
    </CourierLayout>
  );
}

function Requirement({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-border bg-background p-3 font-medium text-foreground">{children}</div>;
}

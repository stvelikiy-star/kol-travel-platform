import { ClientLayout } from "@/components/layout/ClientLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

export default function ClientProfilePage() {
  return (
    <ClientLayout>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary via-secondary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">KÖL Client Profile</Badge>
          <h2 className="mt-4 text-2xl font-semibold sm:text-3xl">Профиль</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Личные данные клиента показываются только после подтверждённой авторизации. KÖL не подставляет вымышленные имя, телефон, email, адрес или каналы связи.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardHeader>
          <CardTitle>Редактирование профиля пока недоступно</CardTitle>
          <CardDescription>Перед включением нужны защищённое чтение профиля, проверка изменений на сервере, журнал чувствительных операций и подтверждённая модель уведомлений.</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Защита персональных данных</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Requirement>Доступ только для авторизованного клиента.</Requirement>
            <Requirement>Клиент видит только собственный профиль.</Requirement>
            <Requirement>Показывается только необходимый набор персональных полей.</Requirement>
            <Requirement>Если профиль не подтверждён, данные не подменяются демо-значениями.</Requirement>
          </CardContent>
        </Card>
        <Card className="border-primary/25 bg-lake-light">
          <CardHeader><CardTitle>Безопасное редактирование</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Requirement>Имя, контакты и настройки изменяются только через проверенный серверный процесс.</Requirement>
            <Requirement>Телефон и email подтверждаются там, где это необходимо.</Requirement>
            <Requirement>Кнопка «Сохранить» появится только вместе с реальной записью и проверкой прав.</Requirement>
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
}

function Requirement({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-border bg-background p-3 font-medium leading-6 text-foreground">{children}</div>;
}

import { ClientLayout } from "@/components/layout/ClientLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

export default function ClientSupportPage() {
  return (
    <ClientLayout>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary via-secondary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">KÖL Support</Badge>
          <h2 className="mt-4 text-2xl font-semibold sm:text-3xl">Поддержка</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Раздел поддержки спроектирован как единая очередь обращений по заказам, бронированиям и работе сервиса. Пока рабочий канал обращений не подключён, KÖL не создаёт вымышленные заявки и статусы.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardHeader>
          <CardTitle>Отправка обращений пока недоступна</CardTitle>
          <CardDescription>Для рабочего запуска нужны авторизованный клиент, сохранение заявок, категории и приоритеты, журнал изменений и реальный маршрут эскалации команде поддержки.</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Как будет работать поддержка</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Requirement>Каждое обращение связано с подтверждённым клиентом.</Requirement>
            <Requirement>При необходимости обращение связывается с конкретным заказом или бронью.</Requirement>
            <Requirement>Повторная отправка не создаёт дубликаты одной и той же операции.</Requirement>
            <Requirement>Администратор получает очередь и реальные статусы: открыто, в работе, решено.</Requirement>
          </CardContent>
        </Card>
        <Card className="border-primary/25 bg-lake-light">
          <CardHeader><CardTitle>Что KÖL не имитирует</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Requirement>Не показывает вымышленные обращения.</Requirement>
            <Requirement>Не придумывает приоритет и статус решения.</Requirement>
            <Requirement>Не обещает отправку в мессенджер или CRM, пока канал фактически не подключён.</Requirement>
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
}

function Requirement({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-border bg-background p-3 font-medium leading-6 text-foreground">{children}</div>;
}

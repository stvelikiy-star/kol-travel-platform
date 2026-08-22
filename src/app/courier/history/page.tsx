import { CourierLayout } from "@/components/layout/CourierLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

export default function CourierHistoryPage() {
  return (
    <CourierLayout status="online">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Courier history locked</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">История доставок</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            История не строится из общего orders-каталога и не дополняется вымышленными временем, маршрутами или доходом.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium leading-6 text-foreground">
          Текущий courier-scoped reader покрывает активные назначения. Для завершённых доставок нужен отдельный history reader с проверкой courier ownership и архивных assignment-статусов.
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Что требуется для истории</CardTitle>
            <CardDescription>Только подтверждённые данные текущего курьера.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Requirement>Scoped query по завершённым courier assignments.</Requirement>
            <Requirement>Серверная проверка courier_id текущего пользователя.</Requirement>
            <Requirement>Фактические timestamps начала и завершения.</Requirement>
            <Requirement>Отдельный finance ledger для дохода и выплат.</Requirement>
          </CardContent>
        </Card>

        <Card className="border-danger/30 bg-danger/10">
          <CardHeader>
            <CardTitle>Что запрещено подменять</CardTitle>
            <CardDescription>До подключения history backend значения не рассчитываются из mock/general orders.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Requirement>«Сегодня / неделя / месяц» без реальных timestamps.</Requirement>
            <Requirement>Среднее время доставки без событий маршрута.</Requirement>
            <Requirement>Доход курьера без finance ledger.</Requirement>
            <Requirement>Контакты и маршрут клиента без scoped contact access.</Requirement>
          </CardContent>
        </Card>
      </div>
    </CourierLayout>
  );
}

function Requirement({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-border bg-background p-3 font-medium text-foreground">{children}</div>;
}

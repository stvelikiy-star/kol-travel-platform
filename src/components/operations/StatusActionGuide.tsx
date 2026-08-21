import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

type StatusActionGuideProps = { mode: "partner" | "courier" };

const partnerOrderFlow = ["Новая заявка", "Принять заказ", "Отклонить заказ", "В приготовлении", "Готов к выдаче", "Ожидает курьера", "Передано курьеру", "Доставка вне зоны партнёра"];
const partnerBookingFlow = ["Новая бронь", "Подтвердить бронь", "Отклонить бронь", "Ожидает гостя", "Гость прибыл", "Завершено", "Изменение/отмена требует админа"];
const courierDeliveryFlow = ["Доступная доставка", "Принять доставку", "Еду к партнёру", "Забрал заказ", "Еду к клиенту", "Доставлено", "Проблема на доставке", "Админ подключён"];
const partnerActions = ["Принять заказ", "Отклонить", "Начать приготовление", "Готов к выдаче", "Сообщить проблему", "Связаться с админом"];
const courierActions = ["Принять доставку", "Еду к партнёру", "Забрал заказ", "Еду к клиенту", "Доставлено", "Сообщить проблему", "Связаться с админом"];

export function StatusActionGuide({ mode }: StatusActionGuideProps) {
  const isPartner = mode === "partner";
  return (
    <Card className="border-accent/30 bg-background/90 shadow-card">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="info">Схема статусов</Badge>
          <Badge variant="muted">Режим просмотра</Badge>
          <Badge variant="warning">Без записи данных</Badge>
        </div>
        <div>
          <CardTitle className="text-base">{isPartner ? "Действия партнёра" : "Действия курьера"}</CardTitle>
          <CardDescription>{isPartner ? "Партнёр ведёт заказ до готовности к выдаче; дальше начинается зона доставки." : "Курьер ведёт физическую доставку и эскалирует проблемы администратору."}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPartner ? <><Flow title="Статусы заказа" steps={partnerOrderFlow} /><Flow title="Статусы бронирования" steps={partnerBookingFlow} /></> : <Flow title="Статусы доставки" steps={courierDeliveryFlow} />}
        <div className="grid gap-2 sm:grid-cols-2">
          {(isPartner ? partnerActions : courierActions).map((action, index) => (
            <Button className="justify-center" key={action} variant={index === 1 ? "danger" : index % 2 === 0 ? "primary" : "outline"}>{action}</Button>
          ))}
        </div>
        <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm leading-6 text-foreground">
          Режим просмотра: эти действия не вызывают backend, не записывают данные и не меняют оплату или статус заказа. После подключения серверного контракта операции должны проходить проверку роли и журналироваться.
        </div>
      </CardContent>
    </Card>
  );
}

function Flow({ steps, title }: { steps: string[]; title: string }) {
  return <div className="rounded-md border border-border bg-surface p-3"><p className="mb-3 text-sm font-semibold text-foreground">{title}</p><div className="flex flex-wrap gap-2">{steps.map((step, index) => <Badge key={step} variant={index === 0 ? "info" : index === steps.length - 1 ? "warning" : "muted"}>{index + 1}. {step}</Badge>)}</div></div>;
}

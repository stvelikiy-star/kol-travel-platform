import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

type StatusActionGuideProps = {
  mode: "partner" | "courier";
};

const partnerOrderFlow = [
  "Новая заявка",
  "Принять заказ",
  "Отклонить заказ",
  "В приготовлении",
  "Готов к выдаче",
  "Ожидает курьера",
  "Передано курьеру",
  "Доставка вне зоны партнёра"
];

const partnerBookingFlow = [
  "Новая бронь",
  "Подтвердить бронь",
  "Отклонить бронь",
  "Ожидает гостя",
  "Гость прибыл",
  "Завершено",
  "Изменение/отмена требует админа"
];

const courierDeliveryFlow = [
  "Доступная доставка",
  "Принять доставку",
  "Еду к партнёру",
  "Забрал заказ",
  "Еду к клиенту",
  "Доставлено",
  "Проблема на доставке",
  "Админ подключён"
];

const partnerActions = ["Принять заказ", "Отклонить", "Начать приготовление", "Готов к выдаче", "Сообщить проблему", "Связаться с админом"];
const courierActions = ["Принять доставку", "Еду к партнёру", "Забрал заказ", "Еду к клиенту", "Доставлено", "Сообщить проблему", "Связаться с админом"];

export function StatusActionGuide({ mode }: StatusActionGuideProps) {
  const isPartner = mode === "partner";

  return (
    <Card className="border-accent/30 bg-background/90 shadow-card">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="info">status flow</Badge>
          <Badge variant="muted">UI/demo only</Badge>
          <Badge variant="warning">no backend mutation</Badge>
        </div>
        <div>
          <CardTitle className="text-base">{isPartner ? "Demo status actions партнёра" : "Demo status actions курьера"}</CardTitle>
          <CardDescription>
            {isPartner
              ? "Партнёр ведёт заказ до ready_for_pickup; дальше доставка вне зоны партнёра."
              : "Курьер ведёт только физическую доставку и эскалирует проблемы."}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPartner ? (
          <>
            <Flow title="Order status flow" steps={partnerOrderFlow} />
            <Flow title="Booking status flow" steps={partnerBookingFlow} />
          </>
        ) : (
          <Flow title="Courier delivery status flow" steps={courierDeliveryFlow} />
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          {(isPartner ? partnerActions : courierActions).map((action, index) => (
            <Button
              className="justify-center"
              disabled={index === (isPartner ? 5 : 6)}
              key={action}
              variant={index === 1 ? "danger" : index % 2 === 0 ? "primary" : "outline"}
            >
              {action} demo
            </Button>
          ))}
        </div>

        <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm leading-6 text-foreground">
          These buttons are UI/demo only. They do not mutate data, do not call backend, do not write to Supabase, and cannot change payment status.
          AI can recommend, alert, suggest reassignment and draft messages, but cannot cancel orders, change payment status or enable alcohol module.
        </div>
      </CardContent>
    </Card>
  );
}

function Flow({ steps, title }: { steps: string[]; title: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="mb-3 text-sm font-semibold text-foreground">{title}</p>
      <div className="flex flex-wrap gap-2">
        {steps.map((step, index) => (
          <Badge key={step} variant={index === 0 ? "info" : index === steps.length - 1 ? "warning" : "muted"}>
            {index + 1}. {step}
          </Badge>
        ))}
      </div>
    </div>
  );
}

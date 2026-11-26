import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

type PartnerIssueEscalationPanelProps = {
  context:
    | "overview"
    | "orders"
    | "order-detail"
    | "bookings"
    | "booking-detail"
    | "delivery"
    | "stop"
    | "settings";
};

const issueCases = [
  "Курьер задерживается",
  "Заказ готов, но не получен",
  "Товар или услуга недоступны",
  "Кухня или партнёр перегружены",
  "Клиент изменил заявку",
  "Клиент попросил отменить устно",
  "Ошибка в деталях заказа",
  "Проблема оплаты",
  "Конфликт бронирования",
  "Гость не прибыл",
  "Требуется срочная остановка"
];

const aiRules = [
  "ИИ может рекомендовать",
  "ИИ может уведомлять администратора",
  "ИИ может подготовить сообщение",
  "ИИ не может отменить заказ",
  "ИИ не может одобрить возврат",
  "ИИ не может изменить оплату",
  "ИИ не может включить продажу алкоголя"
];

const contextCopy: Record<PartnerIssueEscalationPanelProps["context"], string> = {
  overview: "Сообщения о проблемах партнёра, требующих внимания.",
  orders: "Используйте при задержке или блокировке заказа, устном изменении или ожидании выдачи.",
  "order-detail": "Используйте перед запросом отмены, проверки возврата или помощи администратора.",
  bookings: "Используйте при конфликте брони, неявке гостя или изменении даты.",
  "booking-detail": "Используйте перед изменением или отменой подтверждённой брони.",
  delivery: "Используйте, если готовый заказ долго ожидает курьера или передача задерживается.",
  stop: "Используйте для срочной остановки новых заказов. Принятые заказы и брони не отменяются.",
  settings: "Используйте для объяснения, почему настройки требуют проверки администратора."
};

export function PartnerIssueEscalationPanel({ context }: PartnerIssueEscalationPanelProps) {
  return (
    <Card className="border-warning/35 bg-warning/10 shadow-card">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="warning">Заявка на эскалацию</Badge>
          <Badge variant="info">AI-диспетчер рекомендует</Badge>
          <Badge variant="danger">Срочный случай</Badge>
          <Badge variant="muted">ALCOHOL_MODULE_ENABLED=false</Badge>
        </div>
        <div>
          <CardTitle className="text-base">Сообщить проблему партнёра</CardTitle>
          <CardDescription>{contextCopy[context]}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 xl:grid-cols-3">
          <RuleList title="Причина обращения" items={issueCases} tone="warning" />
          <RuleList
            title="Когда подключается админ"
            items={["Проблема оплаты", "Отмена принятого заказа", "Отмена подтверждённой брони", "Курьер не прибыл", "Требуется срочная остановка"]}
            tone="danger"
          />
          <RuleList title="Правила ИИ" items={aiRules} tone="info" />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <RuleList
            title="Что партнёр может делать"
            items={["Партнёр может сообщить о проблеме", "Партнёр может обратиться к администратору", "Партнёр может остановить новые заказы", "Принятые заказы остаются видимыми"]}
            tone="success"
          />
          <RuleList
            title="Что нельзя делать без админа"
            items={["Без администратора нельзя отменять принятые заказы", "Партнёр не может менять статус оплаты", "Партнёр не может принудительно возвращать деньги", "Партнёр не может включить продажу алкоголя"]}
            tone="danger"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="danger">Сообщить проблему (демо)</Button>
          <Button variant="outline">Связаться с администратором (демо)</Button>
          <Button variant="secondary">Остановить новые заказы (демо)</Button>
          <Button disabled variant="outline">Возврат средств отключён</Button>
          <Button disabled variant="outline">Изменение оплаты отключено</Button>
        </div>

        <div className="rounded-md border border-warning/40 bg-surface p-3 text-sm leading-6 text-foreground">
          Продажа и доставка алкоголя отключены. ИИ не может включить этот модуль. Для включения в будущем необходимы юридическая проверка, лицензирование, проверка партнёра и подтверждение главного администратора.
        </div>
      </CardContent>
    </Card>
  );
}

function RuleList({ items, title, tone }: { items: string[]; title: string; tone: "success" | "danger" | "warning" | "info" }) {
  return (
    <div className="rounded-md border border-border bg-background/90 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <Badge variant={tone}>{tone === "danger" ? "Важно" : tone === "warning" ? "Предупреждение" : tone === "info" ? "Информация" : "Разрешено"}</Badge>
      </div>
      <ul className="space-y-1 text-sm leading-5 text-muted">
        {items.map((item) => (
          <li className="wrap-break-word" key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

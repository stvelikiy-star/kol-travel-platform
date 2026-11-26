import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

type CatalogStopContext = "overview" | "tour" | "stay" | "food" | "product";

type PartnerCatalogStopRulesPanelProps = {
  context: CatalogStopContext;
};

const contextCopy: Record<CatalogStopContext, { title: string; focus: string; controls: string[] }> = {
  overview: {
    title: "Управление остановкой продаж",
    focus: "Демонстрационные правила управления турами, жильём, блюдами и товарами.",
    controls: [
      "Управление позицией",
      "Статус позиции",
      "В продаже / Доступно",
      "Временно остановлено",
      "Нет в наличии"
    ]
  },
  tour: {
    title: "Остановка продажи туров",
    focus: "Доступность туров, закрытие дат и времени, отсутствие свободных мест.",
    controls: [
      "тур доступен",
      "тур приостановлен",
      "закрыть дату тура",
      "закрыть время отправления",
      "нет свободных мест"
    ]
  },
  stay: {
    title: "Остановка продажи жилья и номеров",
    focus: "Доступность номеров, остановка типа номера, закрытые даты и конфликты бронирования.",
    controls: [
      "номер доступен",
      "номер приостановлен",
      "остановить тип номера",
      "закрыть даты",
      "конфликт бронирования"
    ]
  },
  food: {
    title: "Остановка продажи блюд",
    focus: "Доступность блюд, остатки, перегрузка кухни и время приготовления.",
    controls: [
      "блюдо доступно",
      "блюдо приостановлено",
      "нет в наличии",
      "кухня перегружена",
      "время приготовления появится позже"
    ]
  },
  product: {
    title: "Остановка продажи товаров",
    focus: "Доступность товаров, остатки и приостановка категории.",
    controls: [
      "товар доступен",
      "товар приостановлен",
      "нет в наличии",
      "мало на складе",
      "остановить категорию товаров"
    ]
  }
};

const stopActions = [
  "Остановить позицию",
  "Остановить категорию",
  "Причина остановки",
  "Когда возобновить",
  "Демонстрационный режим: изменения не сохраняются"
];

const partnerRules = [
  "Партнёр может остановить будущие продажи",
  "Партнёр может остановить отдельную позицию",
  "Партнёр может остановить отдельную категорию",
  "Партнёр может указать причину",
  "Партнёр может указать время возобновления",
  "Без администратора нельзя отменять принятые заказы",
  "Без администратора нельзя отменять подтверждённые брони",
  "Партнёр не может менять статус оплаты",
  "Партнёр не может принудительно возвращать деньги",
  "Партнёр не может включить продажу алкоголя"
];

const aiRules = [
  "ИИ может рекомендовать остановку позиции",
  "ИИ может обнаружить перегрузку или дефицит товара",
  "ИИ может уведомлять администратора",
  "ИИ может подготовить сообщение клиенту или партнёру",
  "ИИ не может отменять принятые заказы и брони",
  "ИИ не может менять оплату",
  "ИИ не может включить продажу алкоголя"
];

const acceptedWorkNotes = [
  "Принятые заказы еды и товаров сохраняются",
  "Подтверждённые брони туров и жилья остаются активными",
  "Доставка в работе не отменяется",
  "Статус оплаты не изменяется",
  "Возвраты требуют одобрения администратора"
];

export function PartnerCatalogStopRulesPanel({ context }: PartnerCatalogStopRulesPanelProps) {
  const copy = contextCopy[context];

  return (
    <section className="grid gap-4">
      <Card className="border-primary/20 bg-primary/10">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="info">Управление позицией</Badge>
            <Badge variant="success">В продаже / Доступно</Badge>
            <Badge variant="warning">Временно остановлено</Badge>
            <Badge variant="danger">Нужен админ</Badge>
            <Badge variant="muted">ALCOHOL_MODULE_ENABLED=false</Badge>
          </div>
          <CardTitle className="text-xl">{copy.title}</CardTitle>
          <CardDescription>{copy.focus}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <RuleColumn title="Статус позиции" items={copy.controls} tone="info" />
          <RuleColumn title="Управление остановкой" items={stopActions} tone="warning" />
          <RuleColumn title="Правила" items={partnerRules} tone="success" />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Что будет с уже принятыми заказами</CardTitle>
            <CardDescription>
              Остановка влияет только на новые продажи и бронирования. Принятые обязательства защищены; отмену согласовывает администратор.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {acceptedWorkNotes.map((item) => (
              <div className="rounded-lg border border-border bg-background p-3 text-sm font-semibold text-foreground" key={item}>
                {item}
              </div>
            ))}
          </CardContent>
          <CardContent className="flex flex-wrap gap-3 pt-0">
            <Button variant="danger">Остановить позицию (демо)</Button>
            <Button variant="outline">Остановить категорию (демо)</Button>
            <Button variant="secondary">Возобновить в назначенное время (демо)</Button>
          </CardContent>
        </Card>

        <Card className="border-danger/30 bg-danger/10">
          <CardHeader>
            <CardTitle>Нужен админ</CardTitle>
            <CardDescription>
              Отмена, оплата, возвраты, правовые вопросы и запросы, связанные с алкоголем, требуют проверки администратора.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {[
              "отмена принятого заказа",
              "отмена подтверждённой брони",
              "изменение статуса оплаты",
              "запрос возврата средств",
              "вопрос законодательства",
              "запрос, связанный с алкоголем"
            ].map((item) => (
              <div className="rounded-lg border border-danger/20 bg-surface p-3 text-sm font-semibold" key={item}>
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Безопасность ИИ</CardTitle>
            <CardDescription>
              ИИ может рекомендовать остановку и готовить сообщения, но не выполняет опасные действия с каталогом.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {aiRules.map((item) => (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3" key={item}>
                <span className="text-sm font-semibold text-foreground">{item}</span>
                <Badge variant={item.includes("не может") ? "danger" : "info"}>{item.includes("не может") ? "Запрещено" : "Разрешено"}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-warning/30 bg-warning/10">
          <CardHeader>
            <CardTitle>Ограничения продажи алкоголя</CardTitle>
            <CardDescription>
              Продажа алкоголя отключена. Остановка позиций каталога не может разрешить продажу или доставку алкоголя.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Badge className="w-fit" variant="danger">
              Продажа и доставка алкоголя отключены
            </Badge>
            <p className="text-sm leading-6 text-muted">
              ИИ не может включить продажу алкоголя. Для возможного включения требуются правовая проверка, лицензия, проверка партнёра и одобрение главного администратора.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function RuleColumn({ items, title, tone }: { items: string[]; title: string; tone: "success" | "info" | "warning" }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <Badge variant={tone}>{title}</Badge>
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <div className="rounded-lg border border-border bg-background p-3 text-sm font-semibold text-foreground" key={item}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

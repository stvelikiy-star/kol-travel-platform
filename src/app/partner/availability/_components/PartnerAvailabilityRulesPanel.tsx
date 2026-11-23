import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

type AvailabilityContext = "overview" | "rooms" | "tours" | "food" | "products";

type PartnerAvailabilityRulesPanelProps = {
  context: AvailabilityContext;
};

const contextCopy: Record<AvailabilityContext, { title: string; focus: string; controls: string[] }> = {
  overview: {
    title: "Управление доступностью",
    focus: "Общий обзор доступности. Изменения дат жилья и туров защищены сервером, а изменение еды и товаров пока доступно только в демонстрационном режиме.",
    controls: ["Что доступно сегодня", "Что остановлено", "Заблокированные даты", "Заблокированные слоты", "Нужно внимание"]
  },
  rooms: {
    title: "Доступность номеров",
    focus: "Открытие и закрытие существующих дат через защищённую серверную операцию. Новые даты и места здесь не создаются.",
    controls: ["открыть будущую дату", "закрыть будущую дату", "видеть количество свободных мест", "зафиксировать конфликт", "отключать бронирование при отсутствии мест"]
  },
  tours: {
    title: "Расписание туров",
    focus: "Открытие и закрытие существующих отправлений через защищённую серверную операцию. Новые туры, даты и места здесь не создаются.",
    controls: ["открыть будущий слот", "закрыть будущий слот", "видеть остаток мест", "зафиксировать конфликт", "отключать бронирование при полной занятости"]
  },
  food: {
    title: "Доступность еды и меню",
    focus: "Доступность блюд, перегрузка кухни, пауза доставки и время приготовления будут управляться отдельно.",
    controls: ["блюдо доступно", "блюдо недоступно", "кухня перегружена", "доставка временно приостановлена", "изменение времени приготовления появится позже"]
  },
  products: {
    title: "Доступность товаров",
    focus: "Остатки товаров, их дефицит и остановка продажи отдельных товаров или категорий.",
    controls: ["в наличии", "нет в наличии", "мало на складе", "остановить продажу товара", "остановить продажу категории"]
  }
};

const todayBlocks = [
  "Что доступно сегодня",
  "Что остановлено",
  "Заблокированные даты",
  "Заблокированные слоты",
  "Конфликты бронирования",
  "Нужно внимание"
];

const partnerRules = [
  "Партнёр может приостанавливать будущие продажи",
  "Принятые заказы и подтверждённые брони сохраняются",
  "Партнёр не может менять статус оплаты",
  "Партнёр не может принудительно возвращать деньги",
  "Партнёр не может вручную восстанавливать проданные остатки",
  "Партнёр не может включить продажу алкоголя"
];

const aiRules = [
  "ИИ может рекомендовать остановку",
  "ИИ может обнаруживать перегрузку",
  "ИИ может обнаруживать конфликт доступности",
  "ИИ может уведомлять администратора",
  "ИИ не может отменять принятые заказы и брони",
  "ИИ не может менять оплату",
  "ИИ не может включить продажу алкоголя"
];

const adminCases = [
  "отмена принятого заказа",
  "отмена подтверждённой брони",
  "проблема оплаты",
  "запрос возврата средств",
  "вопрос законодательства",
  "запрос, связанный с алкоголем"
];

export function PartnerAvailabilityRulesPanel({ context }: PartnerAvailabilityRulesPanelProps) {
  const copy = contextCopy[context];
  const isOperational = context === "rooms" || context === "tours";

  return (
    <section className="grid gap-4">
      <Card className="border-primary/20 bg-primary/10">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="info">Управление доступностью</Badge>
            <Badge variant={isOperational ? "success" : "warning"}>
              {isOperational ? "Рабочие операции подтверждены" : "Демонстрационный режим"}
            </Badge>
            <Badge variant="danger">Высокорисковые действия: админ</Badge>
            <Badge variant="muted">ALCOHOL_MODULE_ENABLED=false</Badge>
          </div>
          <CardTitle className="text-xl">{copy.title}</CardTitle>
          <CardDescription>{copy.focus}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <RuleColumn title={isOperational ? "Рабочие действия" : "Доступные действия"} items={copy.controls} tone="info" />
          <RuleColumn title="Статус доступности" items={todayBlocks} tone="success" />
          <RuleColumn title="Правила" items={partnerRules} tone="warning" />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {isOperational ? (
          <Card>
            <CardHeader>
              <CardTitle>Полномочия на изменения</CardTitle>
              <CardDescription>
                Изменения доступности номеров и туров выполняются через защищённую серверную операцию с проверкой роли, принадлежности бизнеса и журналом действий.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <OperationalFact label="Прямое изменение таблиц" value="Заблокировано" />
              <OperationalFact label="Принятые бронирования" value="Сохранены" />
              <OperationalFact label="Платёжные данные" value="Без изменений" />
              <OperationalFact label="Учёт свободных мест" value="Под контролем базы" />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Будущие серверные операции</CardTitle>
              <CardDescription>
                Изменения еды и товаров будут подключены отдельно. Сейчас эти элементы не изменяют записи в рабочей базе.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <DemoAction label="Остановить позицию или категорию (демо)" />
              <DemoAction label="Перегрузка кухни (демо)" />
            </CardContent>
            <CardContent className="flex flex-wrap gap-3 pt-0">
              <Button variant="secondary">Рекомендация ИИ об остановке (демо)</Button>
              <Button variant="danger">Связаться с администратором (демо)</Button>
            </CardContent>
          </Card>
        )}

        <Card className="border-danger/30 bg-danger/10">
          <CardHeader>
            <CardTitle>Нужен админ</CardTitle>
            <CardDescription>
              Принятые заказы и бронирования защищены. Отмена, оплата и возвраты требуют отдельных утверждённых правил.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {adminCases.map((item) => (
              <div className="rounded-lg border border-danger/20 bg-surface p-3 text-sm font-semibold" key={item}>{item}</div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Безопасность ИИ</CardTitle>
            <CardDescription>ИИ может рекомендовать действия и предупреждать, но не отменять принятые заказы, менять оплату или включать продажу алкоголя.</CardDescription>
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
            <CardTitle>Защита принятых обязательств</CardTitle>
            <CardDescription>
              Изменение доступности влияет только на новые заявки. Принятые заказы и подтверждённые брони не отменяются.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Badge className="w-fit" variant="danger">Продажа и доставка алкоголя отключены</Badge>
            <p className="text-sm leading-6 text-muted">
              `ALCOHOL_MODULE_ENABLED=false`. Возможное включение требует правовой проверки, лицензии, проверки партнёра и подтверждения главного администратора.
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
        {items.map((item) => <div className="rounded-lg border border-border bg-background p-3 text-sm font-semibold text-foreground" key={item}>{item}</div>)}
      </div>
    </div>
  );
}

function OperationalFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function DemoAction({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="mt-1 text-xs leading-5 text-muted">Только демонстрация интерфейса. Изменения в базе не выполняются.</p>
    </div>
  );
}

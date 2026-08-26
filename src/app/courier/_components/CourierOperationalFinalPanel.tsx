import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

type CourierOperationalContext =
  | "overview"
  | "deliveries"
  | "delivery-detail"
  | "active"
  | "history"
  | "earnings"
  | "issues"
  | "profile"
  | "dispatcher";

type CourierOperationalFinalPanelProps = {
  context: CourierOperationalContext;
};

const contextCopy: Record<CourierOperationalContext, { title: string; focus: string }> = {
  overview: { title: "Рабочий контур курьера", focus: "Курьер видит только собственные назначения и не может изменять чужие заказы." },
  deliveries: { title: "Мои доставки", focus: "Список ограничен доставками, назначенными текущему курьеру." },
  "delivery-detail": { title: "Детали доставки", focus: "Детали открываются только для доставки, доступной текущему курьеру." },
  active: { title: "Активная доставка", focus: "KÖL не подменяет активное назначение чужим заказом или вымышленными контактами." },
  history: { title: "История доставок", focus: "История строится только по фактическим завершённым назначениям и времени событий." },
  earnings: { title: "Доход курьера", focus: "Доход и выплаты появятся только из отдельного подтверждённого финансового контура." },
  issues: { title: "Проблемы на доставке", focus: "Создание проблемы требует проверки текущего назначения и сохранения события на сервере." },
  profile: { title: "Профиль курьера", focus: "Личные данные доступны только авторизованному курьеру из его собственного профиля." },
  dispatcher: { title: "AI-помощник курьера", focus: "AI использует подтверждённые события и не выполняет критические действия самостоятельно." }
};

const allowed = [
  "Показывать только данные текущего курьера.",
  "Показывать фактический статус доставки и заказа из разрешённого источника.",
  "Передавать проблему администратору после подключения рабочего канала эскалации.",
  "Использовать AI как помощника и рекомендательный слой на подтверждённых событиях."
];

const blocked = [
  "Курьер не меняет статус оплаты.",
  "Курьер не отменяет заказ и не подтверждает возврат или выплату.",
  "KÖL не придумывает адреса, телефоны, ETA, доход или историю.",
  "Переход статуса доставки выполняется только после проверки назначения и допустимого шага.",
  "Категории с отдельными compliance-требованиями не входят в текущий запуск."
];

export function CourierOperationalFinalPanel({ context }: CourierOperationalFinalPanelProps) {
  const copy = contextCopy[context];

  return (
    <section className="grid gap-4">
      <Card className="border-primary/20 bg-primary/10">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="info">Мои данные</Badge>
            <Badge variant="warning">Защищённые действия</Badge>
            <Badge variant="danger">Критические действия — через администратора</Badge>
          </div>
          <CardTitle className="text-xl">{copy.title}</CardTitle>
          <CardDescription>{copy.focus}</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <RuleCard title="Что доступно курьеру" items={allowed} tone="success" />
        <RuleCard title="Защитные ограничения" items={blocked} tone="danger" />
      </div>
    </section>
  );
}

function RuleCard({ items, title, tone }: { items: string[]; title: string; tone: "success" | "danger" }) {
  return (
    <Card className={tone === "danger" ? "border-danger/30 bg-danger/10" : undefined}>
      <CardHeader>
        <Badge className="w-fit" variant={tone}>{tone === "success" ? "Разрешено" : "Защищено"}</Badge>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {items.map((item) => (
          <div className="rounded-md border border-border bg-background p-3 text-sm font-medium leading-6 text-foreground" key={item}>{item}</div>
        ))}
      </CardContent>
    </Card>
  );
}

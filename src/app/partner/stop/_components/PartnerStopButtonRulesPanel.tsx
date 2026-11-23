import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

const canStop = [
  "Будущие заказы",
  "Будущие брони",
  "Один товар или услугу",
  "Одну категорию",
  "Одну дату",
  "Один временной интервал",
  "Весь бизнес временно"
];

const continues = [
  "Уже принятые заказы остаются в работе",
  "Подтвержденные брони остаются активными",
  "Доставку в работе контролируют курьер, ИИ-диспетчер и администратор KÖL",
  "Финансовые статусы не меняются",
  "Требования к журналу действий сохраняются"
];

const cannotDo = [
  "Нельзя отменить принятый заказ без админа",
  "Нельзя отменить подтвержденную бронь без админа",
  "Нельзя отменить доставку в прогрессе",
  "Нельзя изменить статус оплаты",
  "Нельзя принудительно вернуть деньги",
  "Нельзя включить продажу алкоголя"
];

const adminCases = [
  "отмена принятого заказа",
  "отмена подтверждённой брони",
  "запрос возврата средств",
  "проблема оплаты",
  "срочная остановка всего бизнеса",
  "подозрительная активность",
  "вопрос законодательства",
  "запрос, связанный с алкоголем"
];

const aiRules = [
  "ИИ может рекомендовать остановку",
  "ИИ может обнаружить перегрузку",
  "ИИ может уведомлять администратора",
  "ИИ может подготовить сообщение",
  "ИИ не может отменять принятые заказы",
  "ИИ не может менять оплату",
  "ИИ не может включить продажу алкоголя"
];

export function PartnerStopButtonRulesPanel() {
  return (
    <section className="grid gap-4">
      <Card className="border-warning/30 bg-warning/10">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="warning">Стоп-кнопка</Badge>
            <Badge variant="info">Будущие заявки</Badge>
            <Badge variant="danger">Нужен админ</Badge>
            <Badge variant="muted">ALCOHOL_MODULE_ENABLED=false</Badge>
          </div>
          <CardTitle className="text-xl">Правила остановки партнёра</CardTitle>
          <CardDescription>
            Демонстрационный режим: стоп-кнопка управляет новыми заказами и бронированиями, но не отменяет принятые обязательства.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <RuleColumn title="Что будет остановлено" items={canStop} tone="success" />
          <RuleColumn title="Что продолжит работать" items={continues} tone="info" />
          <RuleColumn title="Что нельзя делать без админа" items={cannotDo} tone="danger" />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Остановить весь бизнес или отдельный раздел</CardTitle>
            <CardDescription>
              Партнёр выбирает раздел, причину и время возобновления. Сохранение изменений здесь пока недоступно.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <DemoField label="Что остановить" value="Новые заказы, брони, товары, даты или время" />
            <DemoField label="Причина остановки" value="Перегрузка кухни, отсутствие товара, закрытая дата или срочная ситуация" />
            <DemoField label="Когда возобновить" value="Через 30 минут, до конца дня или вручную" />
          </CardContent>
          <CardContent className="flex flex-wrap gap-3 pt-0">
            <Button variant="danger">Остановить весь бизнес (демо)</Button>
            <Button variant="outline">Остановить один товар или услугу (демо)</Button>
            <Button variant="outline">Приостановить на 30 минут (демо)</Button>
            <Button variant="secondary">Возобновить (демо)</Button>
          </CardContent>
        </Card>

        <Card className="border-danger/30 bg-danger/10">
          <CardHeader>
            <Badge className="w-fit" variant="danger">
              Срочный случай
            </Badge>
            <CardTitle>Когда нужен админ</CardTitle>
            <CardDescription>
              Для этих ситуаций необходимы подтверждение администратора, обоснование и запись в журнал действий.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {adminCases.map((item) => (
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
              ИИ-диспетчер помогает обнаружить перегрузку и подготовить сообщение, но не выполняет опасные действия.
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

        <Card className="border-primary/20 bg-primary/10">
          <CardHeader>
            <CardTitle>Ограничения продажи алкоголя</CardTitle>
            <CardDescription>
              Продажа алкоголя отключена. Связанные с алкоголем запросы требуют правовой проверки, лицензии, проверки партнёра и одобрения главного администратора.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Badge className="w-fit" variant="danger">
              Продажа и доставка алкоголя отключены
            </Badge>
            <p className="text-sm leading-6 text-muted">
              ИИ не может включить продажу алкоголя. Остановка продаж не разрешает операции с алкоголем и не обходит ограничения.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function RuleColumn({ items, title, tone }: { items: string[]; title: string; tone: "success" | "info" | "danger" }) {
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

function DemoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

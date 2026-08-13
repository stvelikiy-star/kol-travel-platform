import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

const canStop = [
  "Будущие заказы",
  "Будущие брони",
  "Один товар или услугу",
  "Одну категорию",
  "Одну дату",
  "Один time slot",
  "Весь бизнес временно"
];

const continues = [
  "Уже принятые заказы остаются в работе",
  "Подтвержденные брони остаются активными",
  "Доставка в прогрессе контролируется курьером, AI-диспетчером и админом KOL",
  "Финансовые статусы не меняются",
  "Audit requirements сохраняются"
];

const cannotDo = [
  "Нельзя отменить принятый заказ без админа",
  "Нельзя отменить подтвержденную бронь без админа",
  "Нельзя отменить доставку в прогрессе",
  "Нельзя изменить payment status",
  "Нельзя force refund",
  "Нельзя включить alcohol module"
];

const adminCases = [
  "accepted order cancellation",
  "confirmed booking cancellation",
  "refund request",
  "payment issue",
  "full business emergency stop",
  "suspicious behavior",
  "legal/compliance issue",
  "alcohol-related request"
];

const aiRules = [
  "AI can recommend pause",
  "AI can detect overload",
  "AI can alert admin",
  "AI can draft message",
  "AI cannot cancel accepted orders",
  "AI cannot change payment",
  "AI cannot enable alcohol module"
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
          <CardTitle className="text-xl">Правила остановки партнера</CardTitle>
          <CardDescription>
            Demo UI only. Стоп-кнопка управляет будущими заказами, бронями и выбранным scope, но не отменяет уже
            принятые обязательства.
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
            <CardTitle>Остановить весь бизнес или один scope</CardTitle>
            <CardDescription>
              Партнер выбирает scope, причину остановки и planned resume time. Реального submit пока нет.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <DemoField label="Что остановить" value="Новые заказы / брони / item / date / slot" />
            <DemoField label="Причина остановки" value="Перегрузка кухни, нет товара, закрытая дата, emergency" />
            <DemoField label="Когда возобновить" value="Через 30 минут, до конца дня или вручную" />
          </CardContent>
          <CardContent className="flex flex-wrap gap-3 pt-0">
            <Button variant="danger">Остановить весь бизнес demo</Button>
            <Button variant="outline">Остановить один товар/услугу demo</Button>
            <Button variant="outline">Pause 30 min demo</Button>
            <Button variant="secondary">Resume demo</Button>
          </CardContent>
        </Card>

        <Card className="border-danger/30 bg-danger/10">
          <CardHeader>
            <Badge className="w-fit" variant="danger">
              Срочный случай
            </Badge>
            <CardTitle>Когда нужен админ</CardTitle>
            <CardDescription>
              Эти ситуации требуют human/admin approval, reason и будущий audit log.
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
            <CardTitle>AI safety</CardTitle>
            <CardDescription>
              AI-диспетчер помогает обнаружить перегрузку и подготовить сообщение, но не выполняет high-risk actions.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {aiRules.map((item) => (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3" key={item}>
                <span className="text-sm font-semibold text-foreground">{item}</span>
                <Badge variant={item.includes("cannot") ? "danger" : "info"}>{item.includes("cannot") ? "blocked" : "allowed"}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/10">
          <CardHeader>
            <CardTitle>Alcohol compliance</CardTitle>
            <CardDescription>
              Alcohol module remains OFF. Any alcohol-related request is critical risk and requires legal review,
              licensing, partner verification and super_admin approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Badge className="w-fit" variant="danger">
              Alcohol sales/delivery disabled
            </Badge>
            <p className="text-sm leading-6 text-muted">
              AI cannot enable alcohol module. Partner stop controls do not create any alcohol flow and cannot bypass
              compliance.
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

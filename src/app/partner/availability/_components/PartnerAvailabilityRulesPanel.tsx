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
    focus: "Единый обзор доступности. Room/Tour operational writes подключаются по отдельным защищённым контурам; Food/Product остаются demo до своего этапа.",
    controls: ["Что доступно сегодня", "Что остановлено", "Заблокированные даты", "Заблокированные слоты", "Нужно внимание"]
  },
  rooms: {
    title: "Доступность номеров",
    focus: "Room availability status управляется через ownership-scoped atomic RPC. Inventory counters и цены остаются authority базы данных.",
    controls: ["открыть будущую дату", "закрыть будущую дату", "видеть available_count", "зафиксировать конфликт", "fail-closed при exhausted inventory"]
  },
  tours: {
    title: "Расписание туров",
    focus: "Tour schedule status управляется через ownership-scoped atomic RPC. Capacity и booked_count не редактируются этим экраном.",
    controls: ["открыть будущий слот", "закрыть будущий слот", "видеть остаток мест", "зафиксировать конфликт", "fail-closed при full capacity"]
  },
  food: {
    title: "Доступность еды и меню",
    focus: "Item availability, kitchen overload, delivery pause and preparation time changes later.",
    controls: ["item available", "item unavailable", "kitchen overloaded", "delivery temporarily paused", "preparation time changed later"]
  },
  products: {
    title: "Доступность товаров",
    focus: "Stock state, low stock, product stop and category stop.",
    controls: ["in stock", "out of stock", "low stock", "stop one product", "stop category"]
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
  "Partner can pause future availability",
  "Accepted/confirmed work remains active",
  "Partner cannot change payment status",
  "Partner cannot force refund",
  "Partner cannot restore sold inventory manually",
  "Partner cannot enable alcohol module"
];

const aiRules = [
  "AI can recommend pause",
  "AI can detect overload",
  "AI can detect availability conflict",
  "AI can alert admin",
  "AI cannot cancel accepted orders/bookings",
  "AI cannot change payment",
  "AI cannot enable alcohol module"
];

const adminCases = [
  "accepted order cancellation",
  "confirmed booking cancellation",
  "payment issue",
  "refund request",
  "legal/compliance issue",
  "alcohol-related request"
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
              {isOperational ? "Supabase operational" : "Mixed/demo scope"}
            </Badge>
            <Badge variant="danger">Высокорисковые действия: админ</Badge>
            <Badge variant="muted">ALCOHOL_MODULE_ENABLED=false</Badge>
          </div>
          <CardTitle className="text-xl">{copy.title}</CardTitle>
          <CardDescription>{copy.focus}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <RuleColumn title={isOperational ? "Operational controls" : "Current controls"} items={copy.controls} tone="info" />
          <RuleColumn title="Availability status" items={todayBlocks} tone="success" />
          <RuleColumn title="Rules" items={partnerRules} tone="warning" />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {isOperational ? (
          <Card>
            <CardHeader>
              <CardTitle>Operational authority</CardTitle>
              <CardDescription>
                Room/Tour availability writes идут через серверный RPC с Auth, role, ownership, row lock и audit trail.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <OperationalFact label="Direct table DML" value="blocked" />
              <OperationalFact label="Accepted bookings" value="preserved" />
              <OperationalFact label="Payment truth" value="untouched" />
              <OperationalFact label="Inventory counters" value="DB-owned" />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Future backend actions</CardTitle>
              <CardDescription>
                Food/Product operational mutations будут подключены на их отдельном этапе. Сейчас эти элементы не пишут в Supabase.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <DemoAction label="Остановить item/category demo" />
              <DemoAction label="Kitchen overload demo" />
            </CardContent>
            <CardContent className="flex flex-wrap gap-3 pt-0">
              <Button variant="secondary">AI recommends pause demo</Button>
              <Button variant="danger">Связаться с админом demo</Button>
            </CardContent>
          </Card>
        )}

        <Card className="border-danger/30 bg-danger/10">
          <CardHeader>
            <CardTitle>Нужен админ</CardTitle>
            <CardDescription>
              Accepted orders/bookings are protected. Cancellation, payment and refund cases require separate approved rules.
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
            <CardTitle>AI safety</CardTitle>
            <CardDescription>AI can recommend or alert, but cannot cancel accepted work, change payment or enable alcohol module.</CardDescription>
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

        <Card className="border-warning/30 bg-warning/10">
          <CardHeader>
            <CardTitle>Accepted work protection</CardTitle>
            <CardDescription>
              Availability changes affect only future demand. Accepted food/product orders and confirmed room/tour bookings are not cancelled here.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Badge className="w-fit" variant="danger">Alcohol sales/delivery disabled</Badge>
            <p className="text-sm leading-6 text-muted">
              `ALCOHOL_MODULE_ENABLED=false`. Any future alcohol activation requires legal review, licensing, partner verification and explicit super_admin approval.
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
      <p className="mt-1 text-xs leading-5 text-muted">UI-only. No backend write and no Supabase mutation.</p>
    </div>
  );
}

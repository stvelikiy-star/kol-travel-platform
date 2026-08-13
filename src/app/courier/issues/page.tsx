import type { ReactNode } from "react";
import { CourierLayout } from "@/components/layout/CourierLayout";
import { CourierOperationalFinalPanel } from "@/app/courier/_components/CourierOperationalFinalPanel";
import { CourierIssueEscalationPanel } from "@/app/courier/_components/CourierIssueEscalationPanel";
import { CourierIssueDemoActions } from "@/app/courier/issues/CourierIssueDemoActions";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { getDeliveryOrders } from "@/lib/data/orders";

const issueCategories = [
  "partner_delay",
  "courier_delay",
  "client_not_available",
  "wrong_address",
  "item_missing",
  "payment_problem",
  "weather_delay",
  "admin_required"
];

const deliveryOrders = getDeliveryOrders();

const issues: Array<{ id: string; orderId: string; category: string; priority: "low" | "medium" | "high"; text: string }> = [
  {
    id: "issue-demo-001",
    orderId: deliveryOrders[0]?.id ?? "order-demo",
    category: "partner_delay",
    priority: "medium",
    text: "Партнёр задерживает выдачу заказа на 10 минут."
  },
  {
    id: "issue-demo-002",
    orderId: deliveryOrders[1]?.id ?? "order-demo-2",
    category: "wrong_address",
    priority: "high",
    text: "Адрес клиента требует уточнения через поддержку."
  }
];

const priorityVariant: Record<"low" | "medium" | "high", BadgeVariant> = {
  low: "success",
  medium: "warning",
  high: "danger"
};

export default function CourierIssuesPage() {
  return (
    <CourierLayout status="online">
      <CourierOperationalFinalPanel context="issues" />
      <CourierIssueEscalationPanel context="issues" />

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Issue center</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Проблемы доставки</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Demo центр проблем для курьера. Реальная эскалация админу будет подключена позже.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium text-foreground">
          Demo courier cabinet. High-risk problems must be escalated to human admin.
        </CardContent>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Создать проблему demo</CardTitle>
            <CardDescription>Форма не отправляет данные и не создаёт ticket.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Order ID">
              <Input defaultValue={deliveryOrders[0]?.id ?? "order-demo"} />
            </Field>
            <Field label="Category">
              <Select defaultValue="partner_delay">
                {issueCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </Select>
            </Field>
            <Field label="Priority">
              <Select defaultValue="medium">
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </Select>
            </Field>
            <Field label="Message">
              <Textarea defaultValue="Опишите проблему доставки..." />
            </Field>
          </CardContent>
          <CardFooter>
            <Button>Отправить проблему demo</Button>
          </CardFooter>
        </Card>

        <aside className="space-y-5">
          <CourierIssueDemoActions />

          <Card className="border-warning/40 bg-warning/10">
            <CardHeader>
              <CardTitle>AI dispatcher warning</CardTitle>
              <CardDescription>
                High-risk problems must be escalated to human admin. AI dispatcher can recommend action,
                but cannot cancel orders or change payment status.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Issue categories</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {issueCategories.map((category) => (
                <Badge key={category} variant="muted">{category}</Badge>
              ))}
            </CardContent>
          </Card>
        </aside>
      </section>

      <section className="grid gap-4">
        {issues.map((issue) => (
          <Card key={issue.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{issue.category}</CardTitle>
                  <CardDescription>{issue.id} · {issue.orderId}</CardDescription>
                </div>
                <Badge variant={priorityVariant[issue.priority]}>{issue.priority}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="rounded-lg border border-border bg-background p-4 text-sm leading-6 text-foreground">
                {issue.text}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
    </CourierLayout>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-foreground">
      {label}
      {children}
    </label>
  );
}

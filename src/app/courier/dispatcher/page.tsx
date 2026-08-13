import type { ReactNode } from "react";
import { CourierLayout } from "@/components/layout/CourierLayout";
import { CourierOperationalFinalPanel } from "@/app/courier/_components/CourierOperationalFinalPanel";
import { CourierIssueEscalationPanel } from "@/app/courier/_components/CourierIssueEscalationPanel";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getAIRecommendationsDemo } from "@/lib/data/admin";

const monitoringCards = [
  {
    title: "Active monitoring",
    description: "AI-диспетчер отслеживает активные доставки, зависшие заказы, статусы курьера и операционные риски."
  },
  {
    title: "Delay detection",
    description: "Система подсвечивает задержки партнёра, курьера или клиента по заданным временным правилам."
  },
  {
    title: "Courier assignment suggestion",
    description: "AI может рекомендовать назначение или переназначение курьера, но не выполняет критические действия без человека."
  },
  {
    title: "Problem escalation",
    description: "При высоком риске AI поднимает проблему админу KÖL и готовит короткие внутренние сообщения."
  },
  {
    title: "Human approval required",
    description: "Деньги, отмены, спорные статусы и юридически чувствительные решения требуют подтверждения human admin."
  }
];

const decisionFields = [
  "situation_summary",
  "risk_level: low / medium / high / critical",
  "recommended_action",
  "who_to_notify: admin / partner / courier / client",
  "message_to_admin",
  "message_to_partner",
  "message_to_courier",
  "message_to_client",
  "human_approval_required"
];

const timeRules = [
  "partner does not accept in 5 minutes -> alert admin",
  "ready_for_pickup and no courier for 7 minutes -> urgent courier search",
  "courier assigned but not accepted in 3 minutes -> reassign suggestion",
  "courier picked up but delayed -> alert admin",
  "client not reachable -> admin escalation"
];

const safetyRules = [
  "AI never invents facts.",
  "AI never cancels orders without admin approval.",
  "AI never changes payment status.",
  "AI escalates high-risk problems to a human admin.",
  "AI only recommends actions in demo mode.",
  "AI never promises delivery time without data.",
  "AI never enables alcohol delivery."
];

const riskVariant: Record<"low" | "medium" | "high" | "critical", BadgeVariant> = {
  low: "success",
  medium: "warning",
  high: "danger",
  critical: "danger"
};

export default function CourierDispatcherPage() {
  const recommendations = getAIRecommendationsDemo();

  return (
    <CourierLayout status="online">
      <CourierOperationalFinalPanel context="dispatcher" />
      <CourierIssueEscalationPanel context="dispatcher" />

      <div className="space-y-6">
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
            <Badge className="border-white/30 bg-white text-primary">AI delivery admin</Badge>
            <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">AI-диспетчер доставки</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
              AI dispatcher monitors active deliveries, delays, stuck orders, courier acceptance and risk levels.
            </p>
          </div>
        </Card>

        <Card className="border-warning/40 bg-warning/10">
          <CardContent className="p-4 text-sm font-medium text-foreground">
            AI-диспетчер пока работает как demo-control panel. Реальные уведомления и автоматические назначения будут подключены позже.
          </CardContent>
        </Card>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {monitoringCards.map((card, index) => (
            <Card key={card.title}>
              <CardHeader>
                <Badge variant={index < 2 ? "info" : index === 4 ? "warning" : "success"}>demo</Badge>
                <CardTitle className="text-lg">{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>AI decision format</CardTitle>
                <CardDescription>Внутренний JSON-like формат для операционного решения, не клиентское сообщение.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {decisionFields.map((field) => (
                  <div className="rounded-lg border border-border bg-background p-4 font-mono text-sm text-foreground" key={field}>
                    {field}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Time rules</CardTitle>
                <CardDescription>Demo-правила для выявления задержек и эскалаций.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {timeRules.map((rule, index) => (
                  <RuleRow key={rule} marker={`${index + 1}`} tone={index > 1 ? "warning" : "info"}>
                    {rule}
                  </RuleRow>
                ))}
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Risk levels</CardTitle>
                <CardDescription>AI использует риск только как рекомендацию для человека. Demo recommendations: {recommendations.length}.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {(["low", "medium", "high", "critical"] as const).map((risk) => (
                  <div className="flex items-center justify-between rounded-lg border border-border bg-background p-3" key={risk}>
                    <span className="font-semibold text-foreground">{risk}</span>
                    <Badge variant={riskVariant[risk]}>{risk}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-danger/30 bg-danger/10">
              <CardHeader>
                <CardTitle>AI safety rules</CardTitle>
                <CardDescription>Ограничения AI-диспетчера для MVP и production.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                {safetyRules.map((rule) => (
                  <div className="rounded-md border border-danger/20 bg-surface p-3 text-sm font-medium text-foreground" key={rule}>
                    {rule}
                  </div>
                ))}
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </CourierLayout>
  );
}

function RuleRow({ children, marker, tone }: { children: ReactNode; marker: string; tone: "info" | "warning" }) {
  return (
    <div className="grid gap-3 rounded-lg border border-border bg-background p-4 sm:grid-cols-[52px_minmax(0,1fr)]">
      <Badge variant={tone}>{marker}</Badge>
      <p className="text-sm font-semibold text-foreground">{children}</p>
    </div>
  );
}

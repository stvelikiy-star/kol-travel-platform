import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

const decisionFields = [
  "situation_summary",
  "risk_level",
  "recommended_action",
  "who_to_notify",
  "human_approval_required",
  "evidence_refs"
];

export default function AdminAiDispatcherPage() {
  return (
    <AdminLayout status="attention">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-lake-dark via-primary to-sand p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">AI dispatcher locked</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">AI-диспетчер</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Диспетчерский AI не показывает придуманные рекомендации, SLA, задержки или назначения. Рабочий режим откроется только поверх подтверждённых событий Resort/Travel OS и deterministic rules.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardHeader>
          <CardTitle>Operational AI ещё не активирован</CardTitle>
          <CardDescription>
            Нет fake alerts, reassignment, courier suggestions или внутренних эскалаций. До подключения backend этот экран является контрактом, а не симулятором операций.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Что требуется для включения</CardTitle>
            <CardDescription>Все входы должны быть проверяемыми и серверными.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Requirement>Event stream с реальными timestamps для order/delivery/partner/courier событий.</Requirement>
            <Requirement>Версионируемая SLA-конфигурация вместо зашитых в UI минут.</Requirement>
            <Requirement>Deterministic rules для статусов, дедлайнов и эскалаций.</Requirement>
            <Requirement>Assignment-aware server actions и audit log для операционных изменений.</Requirement>
            <Requirement>Human approval для high-risk изменений; AI не меняет payment state.</Requirement>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Контракт AI decision</CardTitle>
            <CardDescription>Рекомендуемый структурированный ответ после подключения реальных данных.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {decisionFields.map((field) => (
              <div className="rounded-lg border border-border bg-background p-4 font-mono text-sm text-foreground" key={field}>{field}</div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-danger/30 bg-danger/10">
        <CardHeader><CardTitle>Непереходимые границы</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <Requirement>AI не придумывает факты, ETA, availability, payment status или courier state.</Requirement>
          <Requirement>AI не отменяет заказ и не делает финансово значимое действие без разрешённого server workflow.</Requirement>
          <Requirement>Alcohol module остаётся выключенным.</Requirement>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}

function Requirement({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-border bg-surface p-3 font-medium text-foreground">{children}</div>;
}

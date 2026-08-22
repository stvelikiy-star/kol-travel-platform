import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

const immutableSafetyFlags = [
  "KOL_PRODUCTION_RUNTIME_READY must remain false until release gates pass.",
  "ALCOHOL_MODULE_ENABLED must remain false.",
  "Payment/refund/payout activation is not controlled from browser UI.",
  "External-call integrations require explicit server-side configuration and auditability."
];

export default function AdminSettingsPage() {
  return (
    <AdminLayout status="attention">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-lake-dark via-primary to-sand p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Settings locked</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Настройки</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Browser UI не имитирует изменение environment, интеграций, compliance или release flags. Конфигурация появится здесь только после server-side settings store и audit log.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardHeader><CardTitle>Редактирование настроек отключено</CardTitle><CardDescription>Нет UI-only Save и нет полей, которые выглядят как реальные env values без подтверждённого backend.</CardDescription></CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Что требуется для settings backend</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Requirement>Typed allowlist разрешённых настроек.</Requirement>
            <Requirement>Server-side role check и audit log каждого изменения.</Requirement>
            <Requirement>Разделение runtime config, secrets и user preferences.</Requirement>
            <Requirement>Validation/rollback для критических флагов.</Requirement>
          </CardContent>
        </Card>

        <Card className="border-danger/30 bg-danger/10">
          <CardHeader><CardTitle>Safety invariants</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {immutableSafetyFlags.map((rule) => <Requirement key={rule}>{rule}</Requirement>)}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function Requirement({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-border bg-background p-3 font-medium text-foreground">{children}</div>;
}

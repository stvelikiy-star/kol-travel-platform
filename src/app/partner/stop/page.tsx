import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

const affectedScopes = ["new orders", "new bookings", "selected catalog item", "delivery availability"];
const invariants = [
  "Accepted orders/bookings are not cancelled by stop.",
  "Payment status is not changed by stop.",
  "Catalog records are not deleted by stop.",
  "Every stop/resume change requires ownership check and audit log."
];

export default function PartnerStopPage() {
  return (
    <PartnerLayout>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Stop controls locked</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Стоп-кнопка</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Статусы остановки бизнеса, доставки и отдельных позиций не подменяются demo active/paused значениями. Изменения включатся только после реального PartnerStopStatus backend.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardHeader><CardTitle>Stop/resume actions отключены</CardTitle><CardDescription>Нужны partner ownership check, scope validation, deterministic availability rules и audit log.</CardDescription></CardHeader>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Поддерживаемые scopes</CardTitle><CardDescription>Контракт будущего backend, а не текущие статусы.</CardDescription></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {affectedScopes.map((scope) => <Rule key={scope}>{scope}</Rule>)}
          </CardContent>
        </Card>
        <Card className="border-danger/30 bg-danger/10">
          <CardHeader><CardTitle>Инварианты безопасности</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {invariants.map((rule) => <Rule key={rule}>{rule}</Rule>)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5"><Badge variant="muted">Current stop status: unavailable until scoped backend is connected</Badge></CardContent>
      </Card>
    </PartnerLayout>
  );
}

function Rule({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-border bg-background p-3 font-medium text-foreground">{children}</div>;
}

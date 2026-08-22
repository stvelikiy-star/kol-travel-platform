import { ClientLayout } from "@/components/layout/ClientLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

export default function ClientSupportPage() {
  return (
    <ClientLayout>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary via-secondary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Support locked</Badge>
          <h2 className="mt-4 text-2xl font-semibold sm:text-3xl">Поддержка</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            KÖL не показывает вымышленные обращения и не предлагает кнопку, которая выглядит как отправка в CRM, пока server-side support write не подключён.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardHeader><CardTitle>Создание обращений отключено</CardTitle><CardDescription>Нужны authenticated client scope, ticket persistence, category/priority rules, audit trail и реальный канал эскалации.</CardDescription></CardHeader>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Что требуется для support CRM</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Requirement>Ticket records, связанные с authenticated client_id.</Requirement>
            <Requirement>Optional order/booking relation с ownership validation.</Requirement>
            <Requirement>Server action с idempotency и audit log.</Requirement>
            <Requirement>Admin/support queue и реальные статусы open/pending/resolved.</Requirement>
          </CardContent>
        </Card>
        <Card className="border-danger/30 bg-danger/10">
          <CardHeader><CardTitle>Что не симулируется</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Requirement>Нет fake tickets.</Requirement>
            <Requirement>Нет fake priority/status.</Requirement>
            <Requirement>Нет обещания отправки в Telegram/n8n/CRM без backend.</Requirement>
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
}

function Requirement({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-border bg-background p-3 font-medium text-foreground">{children}</div>;
}

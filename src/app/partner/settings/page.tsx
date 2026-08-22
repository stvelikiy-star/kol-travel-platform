import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getPartnerCabinetSummaryReadResult } from "@/lib/data/partners";

export default async function PartnerSettingsPage() {
  const partnerResult = await getPartnerCabinetSummaryReadResult();
  const partner = partnerResult.ok ? partnerResult.data : undefined;

  return (
    <PartnerLayout>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Partner settings locked</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Настройки партнёра</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            KÖL не подставляет вымышленные контакты, сотрудников, рабочие часы, pickup-адреса или notification flags. Изменения откроются только через partner-scoped settings backend.
          </p>
        </div>
      </Card>

      <Card className="border-primary/20 bg-surface">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <Badge variant={partnerResult.ok ? "success" : "muted"}>{partnerResult.ok ? partnerResult.source : partnerResult.code ?? "unavailable"}</Badge>
          <p className="max-w-3xl text-muted">{partnerResult.ok ? "Подтверждённые базовые данные бизнеса читаются из partner profile." : "Partner profile недоступен; mock profile не используется как fallback."}</p>
        </CardContent>
      </Card>

      {partner ? (
        <Card>
          <CardHeader><CardTitle>Подтверждённый business profile</CardTitle><CardDescription>Только поля, полученные из scoped read.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Info label="Business ID" value={partner.id} />
            <Info label="Title" value={partner.title} />
            <Info label="Type" value={partner.type} />
            <Info label="Status" value={partner.status} />
            <Info label="Location" value={partner.location} />
            <Info label="Rating" value={String(partner.rating)} />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Settings read/write contract</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Requirement>Partner ownership + active role on every read/write.</Requirement>
            <Requirement>Typed allowlist for editable public business fields.</Requirement>
            <Requirement>Dedicated records for business hours, pickup points and notification preferences.</Requirement>
            <Requirement>Server-side validation and audit log for every mutation.</Requirement>
          </CardContent>
        </Card>
        <Card className="border-warning/40 bg-warning/10">
          <CardHeader><CardTitle>Редактирование отключено</CardTitle><CardDescription>No UI-only Save, fake staff directory or invented delivery/settings state.</CardDescription></CardHeader>
        </Card>
      </div>
    </PartnerLayout>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-border bg-background p-3"><p className="text-xs text-muted">{label}</p><p className="break-all font-semibold text-foreground">{value}</p></div>;
}
function Requirement({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-border bg-background p-3 font-medium text-foreground">{children}</div>;
}

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
          <Badge className="border-white/30 bg-white text-primary">KÖL Partner Settings</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Настройки партнёра</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Контакты, сотрудники, рабочие часы, адреса выдачи и уведомления показываются только из подтверждённых данных бизнеса. KÖL не заполняет отсутствующие настройки вымышленными значениями.
          </p>
        </div>
      </Card>

      <Card className="border-primary/20 bg-surface">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <Badge variant={partnerResult.ok ? "success" : "muted"}>{partnerResult.ok ? "Профиль подтверждён" : "Профиль недоступен"}</Badge>
          <p className="max-w-3xl text-muted">{partnerResult.ok ? "Базовые данные бизнеса загружены из профиля текущего партнёра." : "Профиль бизнеса сейчас недоступен; демонстрационные данные вместо него не подставляются."}</p>
        </CardContent>
      </Card>

      {partner ? (
        <Card>
          <CardHeader><CardTitle>Профиль бизнеса</CardTitle><CardDescription>Подтверждённые данные текущего партнёра.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Info label="ID бизнеса" value={partner.id} />
            <Info label="Название" value={partner.title} />
            <Info label="Тип" value={partner.type} />
            <Info label="Статус" value={partner.businessStatus} />
            <Info label="Локация" value={partner.location} />
            <Info label="Рейтинг" value={String(partner.rating)} />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Как будут меняться настройки</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Requirement>Каждое чтение и изменение проверяет принадлежность бизнеса и активную роль.</Requirement>
            <Requirement>Редактируются только заранее разрешённые публичные поля бизнеса.</Requirement>
            <Requirement>Рабочие часы, точки выдачи и уведомления хранятся как отдельные подтверждённые настройки.</Requirement>
            <Requirement>Каждое изменение проходит серверную проверку и попадает в журнал изменений.</Requirement>
          </CardContent>
        </Card>
        <Card className="border-warning/40 bg-warning/10">
          <CardHeader><CardTitle>Редактирование пока недоступно</CardTitle><CardDescription>Кнопка сохранения, сотрудники и операционные настройки появятся только вместе с реальной серверной записью и проверкой прав.</CardDescription></CardHeader>
        </Card>
      </div>
    </PartnerLayout>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-border bg-background p-3"><p className="text-xs text-muted">{label}</p><p className="break-all font-semibold text-foreground">{value}</p></div>;
}
function Requirement({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-border bg-background p-3 font-medium leading-6 text-foreground">{children}</div>;
}

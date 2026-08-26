import { ClientLayout } from "@/components/layout/ClientLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

export default function ClientProfilePage() {
  return (
    <ClientLayout>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary via-secondary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Profile locked</Badge>
          <h2 className="mt-4 text-2xl font-semibold sm:text-3xl">Профиль</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Профиль не показывает придуманные имя, телефон, email, адреса или каналы связи. Реальные персональные данные должны приходить только из authenticated client profile с RLS.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardHeader><CardTitle>Редактирование профиля отключено</CardTitle><CardDescription>Нужны scoped profile read, server-side update validation, audit trail для чувствительных изменений и подтверждённая notification model.</CardDescription></CardHeader>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Read contract</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Requirement>Authenticated client_id.</Requirement>
            <Requirement>RLS только на собственный client profile.</Requirement>
            <Requirement>Минимально необходимый набор personal fields.</Requirement>
            <Requirement>Fail-closed при отсутствии профиля.</Requirement>
          </CardContent>
        </Card>
        <Card className="border-danger/30 bg-danger/10">
          <CardHeader><CardTitle>Write contract</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Requirement>Server action для имени/контактов/настроек.</Requirement>
            <Requirement>Phone/email verification при необходимости.</Requirement>
            <Requirement>Никакой UI-only кнопки «Сохранить» без backend.</Requirement>
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
}

function Requirement({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-border bg-background p-3 font-medium text-foreground">{children}</div>;
}

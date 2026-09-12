import { randomUUID } from "node:crypto";
import { updateClientProfileRealAction } from "@/app/actions/client/clientProfileReal";
import { ClientLayout } from "@/components/layout/ClientLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getClientProfileFromSupabase } from "@/lib/data/client-profile-supabase";
import { isSupabaseMode } from "@/lib/data/data-source";

export const dynamic = "force-dynamic";

type ProfileSearchParams = {
  profile?: string | string[];
  code?: string | string[];
};

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ClientProfilePage({
  searchParams
}: {
  searchParams?: Promise<ProfileSearchParams>;
}) {
  const params = await searchParams;
  const state = first(params?.profile);
  const errorCode = first(params?.code);
  const supabaseMode = isSupabaseMode();
  const read = supabaseMode
    ? await getClientProfileFromSupabase()
    : { ok: false as const, profile: null, code: "supabase_not_configured" as const };

  return (
    <ClientLayout>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary via-secondary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">KÖL Client Profile</Badge>
          <h2 className="mt-4 text-2xl font-semibold sm:text-3xl">Профиль</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Данные читаются только из собственного профиля авторизованного клиента. KÖL не подставляет вымышленные имя, телефон, email или адрес.
          </p>
        </div>
      </Card>

      {state === "updated" ? (
        <Card className="border-success/40 bg-success/10">
          <CardContent className="p-4 text-sm font-medium leading-6 text-foreground" role="status">
            Профиль сохранён.
          </CardContent>
        </Card>
      ) : state === "error" ? (
        <Card className="border-danger/40 bg-danger/10">
          <CardContent className="p-4 text-sm font-medium leading-6 text-foreground" role="status">
            Изменения не сохранены. Операция остановлена безопасно{errorCode ? ` · ${errorCode}` : "."}
          </CardContent>
        </Card>
      ) : null}

      {!supabaseMode ? (
        <Card className="border-warning/40 bg-warning/10">
          <CardHeader>
            <CardTitle>Редактирование профиля пока недоступно в preview/mock режиме</CardTitle>
            <CardDescription>Персональные данные и изменения не имитируются без подтверждённого Supabase-контура.</CardDescription>
          </CardHeader>
        </Card>
      ) : !read.ok ? (
        <Card className="border-danger/40 bg-danger/10">
          <CardHeader>
            <CardTitle>Профиль временно недоступен</CardTitle>
            <CardDescription>Неподтверждённые персональные данные не показываются. Попробуйте повторить позже.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Личные данные</CardTitle>
              <CardDescription>Изменяются только безопасные поля собственного профиля. Email показан только для чтения.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updateClientProfileRealAction} className="grid gap-4">
                <input name="requestId" type="hidden" value={`profile-${randomUUID()}`} />
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  Имя
                  <input
                    className="min-h-11 rounded-md border border-border bg-background px-3 py-2"
                    defaultValue={read.profile.fullName ?? ""}
                    maxLength={120}
                    name="fullName"
                    translate="no"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  Email
                  <input
                    className="min-h-11 rounded-md border border-border bg-muted/20 px-3 py-2 text-muted"
                    defaultValue={read.profile.email ?? ""}
                    disabled
                    readOnly
                    translate="no"
                    type="email"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  Язык интерфейса
                  <select className="min-h-11 rounded-md border border-border bg-background px-3 py-2" defaultValue={read.profile.locale} name="locale">
                    <option value="ru">Русский</option>
                    <option value="kg">Кыргызча</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  Адрес по умолчанию
                  <textarea
                    className="min-h-28 rounded-md border border-border bg-background px-3 py-2"
                    defaultValue={read.profile.defaultAddress ?? ""}
                    maxLength={500}
                    name="defaultAddress"
                    translate="no"
                  />
                </label>
                <Button type="submit">Сохранить профиль</Button>
              </form>
            </CardContent>
          </Card>

          <div className="grid content-start gap-5">
            <Card className="border-primary/25 bg-lake-light">
              <CardHeader>
                <CardTitle>Что разрешено менять</CardTitle>
                <CardDescription>Сервер и база данных повторно проверяют allowlist полей.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                <Requirement>Имя клиента.</Requirement>
                <Requirement>Язык интерфейса: RU / KG / EN.</Requirement>
                <Requirement>Собственный адрес по умолчанию.</Requirement>
              </CardContent>
            </Card>

            <Card className="border-warning/40 bg-warning/10">
              <CardHeader><CardTitle>Идентификационные данные защищены</CardTitle></CardHeader>
              <CardContent className="grid gap-2 text-sm">
                <Requirement>Email не меняется этим процессом.</Requirement>
                <Requirement>Телефон, пароль, роль и статус не меняются этим процессом.</Requirement>
                <Requirement>Каждое принятое изменение фиксируется в audit log без открытого имени и адреса.</Requirement>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </ClientLayout>
  );
}

function Requirement({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-border bg-background p-3 font-medium leading-6 text-foreground">{children}</div>;
}

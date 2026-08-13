import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

const settings = [
  { label: "NEXT_PUBLIC_APP_NAME", value: "KOL Travel Platform", locked: false },
  { label: "NEXT_PUBLIC_DEFAULT_LOCALE", value: "ru", locked: false },
  { label: "PAYMENTS_ENABLED", value: "false", locked: true },
  { label: "TELEGRAM_ENABLE_REAL_CALLS", value: "false", locked: true },
  { label: "N8N_ENABLE_REAL_CALLS", value: "false", locked: true },
  { label: "ALCOHOL_MODULE_ENABLED", value: "false", locked: true }
];

export default function AdminSettingsPage() {
  return (
    <AdminLayout status="attention">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-lake-dark via-primary to-sand p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Admin settings</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Настройки</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Demo settings panel. Реальные роли, environment management и audit log будут подключены позже.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium text-foreground">
          Demo settings only. Критические переключатели заблокированы до юридической, платёжной и технической настройки.
        </CardContent>
      </Card>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Platform configuration demo</CardTitle>
            <CardDescription>Состояния показаны как UI mock, без записи в backend.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {settings.map((item) => (
              <div className="grid gap-3 rounded-lg border border-border/80 bg-background p-4 md:grid-cols-[1fr_220px_auto]" key={item.label}>
                <div>
                  <p className="font-semibold text-foreground">{item.label}</p>
                  <p className="text-sm text-muted">{item.locked ? "Locked demo setting" : "Editable demo setting"}</p>
                </div>
                <Input disabled={item.locked} value={item.value} readOnly />
                <Badge variant={item.locked ? "warning" : "info"}>{item.locked ? "locked" : "demo"}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <aside className="space-y-6">
          <Card className="border-danger/30 bg-danger/10">
            <CardHeader>
              <CardTitle>Alcohol compliance lock</CardTitle>
              <CardDescription>ALCOHOL_MODULE_ENABLED=false is visible and locked.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="rounded-md border border-danger/20 bg-surface p-3 text-sm font-semibold text-foreground">
                Alcohol module remains OFF until legal approval.
              </div>
              <div className="rounded-md border border-danger/20 bg-surface p-3 text-sm font-semibold text-foreground">
                Alcohol routes/products must stay gated and hidden.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preferences demo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Select defaultValue="ru">
                <option value="ru">Русский</option>
                <option value="kg">Кыргызский later</option>
                <option value="en">English later</option>
              </Select>
              <Button>Сохранить demo</Button>
            </CardContent>
          </Card>
        </aside>
      </section>
    </AdminLayout>
  );
}

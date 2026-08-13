import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { getPartners } from "@/lib/data/partners";

const demoUsers = [
  { name: "Айжан demo", contact: "+996 700 100 101 · client@kol.demo", role: "client", status: "active", created: "2026-06-01", activity: "Сегодня" },
  { name: "Нурбек demo", contact: "+996 700 200 202 · partner@kol.demo", role: "partner", status: "active", created: "2026-05-28", activity: "12 минут назад" },
  { name: "Courier demo", contact: "+996 700 300 303 · courier@kol.demo", role: "courier", status: "review", created: "2026-06-10", activity: "1 час назад" },
  { name: "Admin demo", contact: "admin@kol.demo", role: "admin", status: "active", created: "2026-05-01", activity: "Сейчас" },
  { name: "Blocked demo", contact: "+996 700 400 404", role: "client", status: "blocked", created: "2026-04-20", activity: "7 дней назад" }
];

const partners = getPartners();

const roleCards = [
  { label: "Клиенты", value: 24, description: "Покупатели, гости, бронирования и loyalty." },
  { label: "Партнёры", value: partners.length, description: "Бизнесы, каталоги, stop-кнопка и финансы." },
  { label: "Курьеры", value: 8, description: "Доставки, статусы смен и проблемы маршрутов." },
  { label: "Админы", value: 2, description: "Demo admin access and future role management." }
];

export default function AdminUsersPage() {
  const blocked = demoUsers.filter((user) => user.status === "blocked").length;
  const review = demoUsers.filter((user) => user.status === "review").length;

  return (
    <AdminLayout status="attention">
      <PageHero title="Пользователи" description="Demo обзор пользователей, ролей и статусов доступа платформы KÖL." />
      <DemoAlert text="Real auth and roles will be connected later. Admin actions are demo only." />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Всего пользователей" value={demoUsers.length + 32} tone="info" />
        <StatCard label="Активные" value={demoUsers.filter((user) => user.status === "active").length + 29} tone="success" />
        <StatCard label="Заблокированные demo" value={blocked} tone="danger" />
        <StatCard label="Требуют проверки" value={review} tone="warning" />
      </section>

      <FilterCard placeholder="Поиск по имени, телефону или email" />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {roleCards.map((role) => (
          <Card key={role.label}>
            <CardContent className="space-y-3 p-5">
              <Badge variant="muted">{role.label}</Badge>
              <p className="text-3xl font-semibold text-primary">{role.value}</p>
              <p className="text-sm text-muted">{role.description}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4">
        {demoUsers.map((user) => (
          <Card key={user.name}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{user.name}</CardTitle>
                  <CardDescription>{user.contact}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="info">{user.role}</Badge>
                  <Badge variant={statusTone(user.status)}>{user.status}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Info label="Created date" value={user.created} />
              <Info label="Last activity" value={user.activity} />
            </CardContent>
            <CardFooter>
              <Button>Открыть demo</Button>
              <Button variant="outline">Проверить demo</Button>
              <Button variant="danger">Заблокировать demo</Button>
            </CardFooter>
          </Card>
        ))}
      </section>
    </AdminLayout>
  );
}

function PageHero({ description, title }: { description: string; title: string }) {
  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-br from-slate-900 via-primary to-accent p-6 text-white">
        <Badge className="border-white/30 bg-white text-primary">Admin users</Badge>
        <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">{title}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">{description}</p>
      </div>
    </Card>
  );
}

function DemoAlert({ text }: { text: string }) {
  return <Card className="border-warning/40 bg-warning/10"><CardContent className="p-4 text-sm font-medium text-foreground">{text}</CardContent></Card>;
}

function FilterCard({ placeholder }: { placeholder: string }) {
  return (
    <Card>
      <CardHeader><CardTitle>Поиск и фильтры</CardTitle><CardDescription>Demo UI без реального запроса к базе.</CardDescription></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_160px]">
        <Input placeholder={placeholder} />
        <Select defaultValue="all"><option value="all">Все роли</option><option value="client">Клиенты</option><option value="partner">Партнёры</option><option value="courier">Курьеры</option><option value="admin">Админы</option></Select>
        <Button>Найти demo</Button>
      </CardContent>
    </Card>
  );
}

function StatCard({ label, tone, value }: { label: string; tone: BadgeVariant; value: string | number }) {
  return <Card><CardContent className="space-y-3 p-5"><p className="text-sm font-medium text-muted">{label}</p><p className="text-3xl font-semibold text-primary">{value}</p><Badge variant={tone}>admin demo</Badge></CardContent></Card>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-border bg-background p-3"><p className="text-xs font-medium text-muted">{label}</p><p className="mt-1 font-semibold text-foreground">{value}</p></div>;
}

function statusTone(status: string): BadgeVariant {
  if (status === "active") return "success";
  if (status === "blocked") return "danger";
  return "warning";
}

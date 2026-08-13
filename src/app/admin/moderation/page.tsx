import type { ReactNode } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getAdminBookings, getAdminOrders } from "@/lib/data/admin";
import { getPartners } from "@/lib/data/partners";

type RiskLevel = "low" | "medium" | "high" | "critical";
type ModerationStatus = "pending" | "review" | "approved_demo" | "hidden_demo" | "needs_work";

const adminOrders = getAdminOrders();
const adminBookings = getAdminBookings();
const partners = getPartners();

const moderationItems: Array<{
  description: string;
  risk: RiskLevel;
  status: ModerationStatus;
  title: string;
  type: string;
}> = [
  {
    title: "Partner verification demo",
    type: "partner",
    status: "pending",
    description: `${partners[0]?.title ?? "Partner"} ожидает проверки документов, контактов и описания бизнеса.`,
    risk: "medium"
  },
  {
    title: "Catalog items demo",
    type: "catalog",
    status: "review",
    description: "Новые позиции каталога требуют проверки описания, цены, фото и availability rules.",
    risk: "low"
  },
  {
    title: "Reviews demo",
    type: "review",
    status: "needs_work",
    description: "Отзыв требует ручной проверки перед публикацией или скрытием.",
    risk: "medium"
  },
  {
    title: "Complaints demo",
    type: "complaint",
    status: "review",
    description: `${adminOrders[2]?.id ?? "order"} имеет жалобу клиента и требует admin review.`,
    risk: "high"
  },
  {
    title: "Stop-button abuse demo",
    type: "stop_button",
    status: "pending",
    description: "Частые stop_business/stop_delivery требуют проверки, чтобы не ломать клиентский опыт.",
    risk: "critical"
  }
];

const riskVariant: Record<RiskLevel, BadgeVariant> = {
  low: "success",
  medium: "warning",
  high: "danger",
  critical: "danger"
};

const statusVariant: Record<ModerationStatus, BadgeVariant> = {
  pending: "warning",
  review: "info",
  approved_demo: "success",
  hidden_demo: "muted",
  needs_work: "warning"
};

export default function AdminModerationPage() {
  return (
    <AdminLayout status="attention">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Moderation demo</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Модерация</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Demo control page для проверки партнёров, каталога, отзывов, жалоб и подозрительного использования stop-кнопки.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium text-foreground">
          Demo moderation panel. Реальная модерация, очереди проверки, audit log и уведомления будут подключены позже.
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Каталог на проверке" value={2} tone="warning" />
        <StatCard label="Новые партнёры" value={1} tone="info" />
        <StatCard label="Жалобы" value={adminOrders.filter((order) => order.status === "cancelled").length + 1} tone="danger" />
        <StatCard label="Скрытые позиции demo" value={1} tone="muted" />
      </section>

      <section className="grid gap-4">
        {moderationItems.map((item) => (
          <ModerationCard key={item.title} item={item} />
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Moderation context demo</CardTitle>
            <CardDescription>Короткая сводка источников для будущей очереди модерации.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <Info label="Partners" value={`${partners.length}`} />
            <Info label="Orders signals" value={`${adminOrders.length}`} />
            <Info label="Booking signals" value={`${adminBookings.length}`} />
          </CardContent>
        </Card>

        <Card className="border-danger/30 bg-danger/10">
          <CardHeader>
            <CardTitle>Moderation rules</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Rule>Alcohol module remains OFF.</Rule>
            <Rule>Suspicious content requires admin review.</Rule>
            <Rule>Partner catalog moderation will be connected later.</Rule>
            <Rule>Moderation actions are demo only.</Rule>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function ModerationCard({ item }: { item: (typeof moderationItems)[number] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{item.title}</CardTitle>
            <CardDescription>{item.description}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="info">{item.type}</Badge>
            <Badge variant={statusVariant[item.status]}>{item.status}</Badge>
            <Badge variant={riskVariant[item.risk]}>{item.risk} risk</Badge>
          </div>
        </div>
      </CardHeader>
      <CardFooter>
        <Button>Одобрить demo</Button>
        <Button variant="danger">Отклонить demo</Button>
        <Button variant="outline">Отправить на доработку demo</Button>
        <Button variant="outline">Скрыть demo</Button>
      </CardFooter>
    </Card>
  );
}

function StatCard({ label, tone, value }: { label: string; tone: BadgeVariant; value: string | number }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="text-3xl font-semibold text-primary">{value}</p>
        <Badge variant={tone}>moderation demo</Badge>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Rule({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-danger/20 bg-surface p-3 text-sm font-medium text-foreground">{children}</div>;
}

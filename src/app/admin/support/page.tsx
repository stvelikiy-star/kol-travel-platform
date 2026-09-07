import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getAdminSupportTicketsFromSupabase } from "@/lib/data/admin-support-supabase";
import { isSupabaseMode } from "@/lib/data/data-source";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage() {
  const supabaseMode = isSupabaseMode();
  const result = supabaseMode
    ? await getAdminSupportTicketsFromSupabase()
    : { ok: false as const, tickets: [], code: "supabase_not_configured" as const };

  return (
    <AdminLayout status={result.ok ? "stable" : "attention"}>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">KÖL Support Queue</Badge>
          <h2 className="mt-4 text-2xl font-semibold sm:text-3xl">Очередь поддержки</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Здесь отображаются только реальные обращения из Supabase. Статус, приоритет и связи с заказом или бронью не подменяются демонстрационными значениями.
          </p>
        </div>
      </Card>

      {!supabaseMode ? (
        <Card className="border-warning/40 bg-warning/10">
          <CardHeader>
            <CardTitle>Очередь недоступна в mock режиме</CardTitle>
            <CardDescription>Admin Support не показывает вымышленные обращения.</CardDescription>
          </CardHeader>
        </Card>
      ) : !result.ok ? (
        <Card className="border-danger/40 bg-danger/10">
          <CardHeader>
            <CardTitle>Не удалось прочитать очередь поддержки</CardTitle>
            <CardDescription>Доступ или Supabase-контур не подтверждены. Операция завершена fail-closed.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Обращения клиентов</CardTitle>
            <CardDescription>До 100 последних заявок. Изменение статуса и ответы администратора будут отдельным audited write-контуром.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {result.tickets.length === 0 ? (
              <div className="rounded-md border border-border bg-background p-4 text-sm text-muted">Очередь пуста.</div>
            ) : result.tickets.map((ticket) => (
              <article className="rounded-md border border-border bg-background p-4" key={ticket.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{ticket.title || "Без темы"}</p>
                    <p className="mt-1 text-xs text-muted">Ticket: {ticket.id}</p>
                    {ticket.createdBy ? <p className="mt-1 text-xs text-muted">Client: {ticket.createdBy}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="info">{ticket.category}</Badge>
                    <Badge variant={ticket.priority === "high" ? "danger" : ticket.priority === "medium" ? "warning" : "muted"}>{ticket.priority}</Badge>
                    <Badge variant={ticket.status === "open" ? "warning" : "muted"}>{ticket.status}</Badge>
                  </div>
                </div>
                <div className="mt-3 grid gap-1 text-sm text-muted sm:grid-cols-2">
                  <p>Создано: {ticket.createdAt.slice(0, 16).replace("T", " ")}</p>
                  <p>Обновлено: {ticket.updatedAt.slice(0, 16).replace("T", " ")}</p>
                  {ticket.relatedOrderId ? <p>Заказ: {ticket.relatedOrderId}</p> : null}
                  {ticket.relatedBookingId ? <p>Бронь: {ticket.relatedBookingId}</p> : null}
                </div>
              </article>
            ))}
          </CardContent>
        </Card>
      )}
    </AdminLayout>
  );
}
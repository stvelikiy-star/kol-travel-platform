import { randomUUID } from "node:crypto";
import { adminSupportFormAction, type AdminSupportStatus } from "@/app/actions/admin/adminSupport";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { requireRole } from "@/lib/auth/roles";
import { getAdminSupportTicketsFromSupabase } from "@/lib/data/admin-support-supabase";
import { isSupabaseMode } from "@/lib/data/data-source";

export const dynamic = "force-dynamic";

type AdminSupportSearchParams = {
  adminSupport?: string | string[];
  action?: string | string[];
  ticket?: string | string[];
  code?: string | string[];
};

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function nextStatus(status: string): { value: AdminSupportStatus; label: string } | null {
  if (status === "open") return { value: "in_progress", label: "Взять в работу" };
  if (status === "in_progress") return { value: "resolved", label: "Отметить решённым" };
  if (status === "resolved") return { value: "closed", label: "Закрыть обращение" };
  return null;
}

export default async function AdminSupportPage({
  searchParams
}: {
  searchParams?: Promise<AdminSupportSearchParams>;
}) {
  const params = await searchParams;
  const mutationState = first(params?.adminSupport);
  const mutationAction = first(params?.action);
  const mutationTicket = first(params?.ticket);
  const mutationCode = first(params?.code);
  const supabaseMode = isSupabaseMode();
  const [result, supportOperator] = await Promise.all([
    supabaseMode
      ? getAdminSupportTicketsFromSupabase()
      : Promise.resolve({ ok: false as const, tickets: [], code: "supabase_not_configured" as const }),
    supabaseMode
      ? requireRole(["support_admin", "super_admin"])
      : Promise.resolve({ ok: false as const })
  ]);
  const canManage = supportOperator.ok;

  return (
    <AdminLayout status={result.ok ? "stable" : "attention"}>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">KÖL Support Queue</Badge>
          <h2 className="mt-4 text-2xl font-semibold sm:text-3xl">Очередь поддержки</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Здесь отображаются только реальные обращения и публичная переписка из Supabase. Ответы и статусы проходят отдельный audited RPC-контур.
          </p>
        </div>
      </Card>

      {mutationState === "success" ? (
        <Card className="border-success/40 bg-success/10">
          <CardContent className="p-4 text-sm font-medium leading-6 text-foreground" role="status">
            Операция поддержки выполнена{mutationAction ? ` · ${mutationAction}` : ""}{mutationTicket ? ` · ${mutationTicket}` : ""}.
          </CardContent>
        </Card>
      ) : mutationState === "error" ? (
        <Card className="border-danger/40 bg-danger/10">
          <CardContent className="p-4 text-sm font-medium leading-6 text-foreground" role="status">
            Операция поддержки остановлена безопасно{mutationCode ? ` · ${mutationCode}` : ""}.
          </CardContent>
        </Card>
      ) : null}

      {!supabaseMode ? (
        <Card className="border-warning/40 bg-warning/10">
          <CardHeader>
            <CardTitle>Очередь недоступна в mock режиме</CardTitle>
            <CardDescription>Admin Support не показывает и не создаёт вымышленные обращения.</CardDescription>
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
            <CardDescription>
              До 100 последних заявок. Write-доступ разрешён только support_admin и super_admin; остальные администраторы видят очередь read-only.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {!canManage ? (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-4 text-sm text-foreground">
                Текущая административная роль имеет только чтение очереди поддержки.
              </div>
            ) : null}
            {result.tickets.length === 0 ? (
              <div className="rounded-md border border-border bg-background p-4 text-sm text-muted">Очередь пуста.</div>
            ) : result.tickets.map((ticket) => {
              const transition = nextStatus(ticket.status);
              return (
                <article className="rounded-md border border-border bg-background p-4" data-support-ticket={ticket.id} key={ticket.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground" translate="no">{ticket.title || "Без темы"}</p>
                      <p className="mt-1 text-xs text-muted">Ticket: {ticket.id}</p>
                      {ticket.createdBy ? <p className="mt-1 text-xs text-muted">Client: {ticket.createdBy}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="info">{ticket.category}</Badge>
                      <Badge variant={ticket.priority === "high" ? "danger" : ticket.priority === "medium" ? "warning" : "muted"}>{ticket.priority}</Badge>
                      <Badge variant={ticket.status === "open" ? "warning" : ticket.status === "in_progress" ? "info" : "muted"}>{ticket.status}</Badge>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-1 text-sm text-muted sm:grid-cols-2">
                    <p>Создано: {ticket.createdAt.slice(0, 16).replace("T", " ")}</p>
                    <p>Обновлено: {ticket.updatedAt.slice(0, 16).replace("T", " ")}</p>
                    {ticket.relatedOrderId ? <p>Заказ: {ticket.relatedOrderId}</p> : null}
                    {ticket.relatedBookingId ? <p>Бронь: {ticket.relatedBookingId}</p> : null}
                  </div>

                  <div className="mt-4 grid gap-2" data-support-conversation={ticket.id}>
                    {ticket.messages.length === 0 ? (
                      <p className="text-sm text-muted">Публичных сообщений пока нет.</p>
                    ) : ticket.messages.map((message) => (
                      <div className="rounded-md border border-border bg-muted/20 p-3" key={message.id}>
                        <div className="flex items-center justify-between gap-3 text-xs text-muted">
                          <span>{message.senderId === ticket.createdBy ? "Клиент" : "Поддержка"}</span>
                          <span>{message.createdAt.slice(0, 16).replace("T", " ")}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-foreground" translate="no">{message.message}</p>
                      </div>
                    ))}
                  </div>

                  {canManage && ticket.status !== "closed" ? (
                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      <form action={adminSupportFormAction} className="grid gap-3 rounded-md border border-border p-3" data-testid="admin-support-reply-form">
                        <input name="ticketId" type="hidden" value={ticket.id} />
                        <input name="action" type="hidden" value="reply" />
                        <input name="requestId" type="hidden" value={`support-reply-${randomUUID()}`} />
                        <label className="grid gap-2 text-sm font-medium text-foreground">
                          Ответ клиенту
                          <textarea className="min-h-24 rounded-md border border-border bg-background px-3 py-2" maxLength={4000} minLength={3} name="message" required />
                        </label>
                        <Button type="submit">Отправить ответ</Button>
                      </form>

                      {transition ? (
                        <form action={adminSupportFormAction} className="grid gap-3 rounded-md border border-border p-3" data-testid="admin-support-status-form">
                          <input name="ticketId" type="hidden" value={ticket.id} />
                          <input name="action" type="hidden" value="status" />
                          <input name="status" type="hidden" value={transition.value} />
                          <input name="requestId" type="hidden" value={`support-status-${randomUUID()}`} />
                          <label className="grid gap-2 text-sm font-medium text-foreground">
                            Причина изменения статуса
                            <input className="min-h-11 rounded-md border border-border bg-background px-3 py-2" maxLength={500} minLength={3} name="reason" required />
                          </label>
                          <Button type="submit" variant="outline">{transition.label}</Button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </CardContent>
        </Card>
      )}
    </AdminLayout>
  );
}

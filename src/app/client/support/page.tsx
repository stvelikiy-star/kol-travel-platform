import { randomUUID } from "node:crypto";
import { createSupportTicketRealAction } from "@/app/actions/client/clientSupportReal";
import { ClientLayout } from "@/components/layout/ClientLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getClientSupportTicketsFromSupabase } from "@/lib/data/client-support-supabase";
import { isSupabaseMode } from "@/lib/data/data-source";

export const dynamic = "force-dynamic";

type SupportSearchParams = {
  support?: string | string[];
  ticket?: string | string[];
  code?: string | string[];
};

const categories = [
  ["general", "Общий вопрос"],
  ["booking", "Бронирование"],
  ["order", "Заказ"],
  ["delivery", "Доставка"],
  ["technical", "Техническая проблема"]
] as const;

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ClientSupportPage({
  searchParams
}: {
  searchParams?: Promise<SupportSearchParams>;
}) {
  const params = await searchParams;
  const state = first(params?.support);
  const ticketId = first(params?.ticket);
  const errorCode = first(params?.code);
  const supabaseMode = isSupabaseMode();
  const read = supabaseMode
    ? await getClientSupportTicketsFromSupabase()
    : { ok: false as const, tickets: [], code: "supabase_not_configured" as const };

  return (
    <ClientLayout>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary via-secondary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">KÖL Support</Badge>
          <h2 className="mt-4 text-2xl font-semibold sm:text-3xl">Поддержка</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Обращения клиента сохраняются в защищённой очереди KÖL. Клиент видит только собственные заявки, администратор — операционную очередь поддержки.
          </p>
        </div>
      </Card>

      {state === "created" ? (
        <Card className="border-success/40 bg-success/10">
          <CardContent className="p-4 text-sm font-medium leading-6 text-foreground" role="status">
            Обращение создано и записано в очередь поддержки{ticketId ? ` · ${ticketId}` : "."}
          </CardContent>
        </Card>
      ) : state === "error" ? (
        <Card className="border-danger/40 bg-danger/10">
          <CardContent className="p-4 text-sm font-medium leading-6 text-foreground" role="status">
            Обращение не создано. Операция остановлена безопасно{errorCode ? ` · ${errorCode}` : "."}
          </CardContent>
        </Card>
      ) : null}

      {!supabaseMode ? (
        <Card className="border-warning/40 bg-warning/10">
          <CardHeader>
            <CardTitle>Поддержка недоступна в preview/mock режиме</CardTitle>
            <CardDescription>Заявки не имитируются и не сохраняются, пока приложение не работает через подтверждённый Supabase-контур.</CardDescription>
          </CardHeader>
        </Card>
      ) : !read.ok ? (
        <Card className="border-danger/40 bg-danger/10">
          <CardHeader>
            <CardTitle>Очередь поддержки временно недоступна</CardTitle>
            <CardDescription>Неподтверждённые данные не показываются. Попробуйте повторить позже.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Новое обращение</CardTitle>
              <CardDescription>Первое сообщение и карточка обращения создаются одной транзакцией.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createSupportTicketRealAction} className="grid gap-4">
                <input name="requestId" type="hidden" value={`support-${randomUUID()}`} />
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  Категория
                  <select className="min-h-11 rounded-md border border-border bg-background px-3 py-2" defaultValue="general" name="category">
                    {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  Тема
                  <input className="min-h-11 rounded-md border border-border bg-background px-3 py-2" maxLength={160} minLength={3} name="title" required />
                </label>
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  Сообщение
                  <textarea className="min-h-36 rounded-md border border-border bg-background px-3 py-2" maxLength={4000} minLength={3} name="message" required />
                </label>
                <Button type="submit">Отправить обращение</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Мои обращения</CardTitle>
              <CardDescription>Последние заявки, прочитанные через RLS от имени текущего клиента.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {read.tickets.length === 0 ? (
                <div className="rounded-md border border-border bg-background p-4 text-sm text-muted">Обращений пока нет.</div>
              ) : read.tickets.map((ticket) => (
                <article className="rounded-md border border-border bg-background p-4" key={ticket.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">{ticket.title || "Без темы"}</p>
                    <div className="flex gap-2">
                      <Badge variant="info">{ticket.category}</Badge>
                      <Badge variant={ticket.status === "open" ? "warning" : "muted"}>{ticket.status}</Badge>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted">{ticket.id}</p>
                  <p className="mt-2 text-sm text-muted">Создано: {ticket.createdAt.slice(0, 16).replace("T", " ")}</p>
                </article>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </ClientLayout>
  );
}
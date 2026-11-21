import { randomUUID } from "node:crypto";
import { adminSupportFormAction, type AdminSupportStatus } from "@/app/actions/admin/adminSupport";
import { adminQuoteIntakeDeliveryAction } from "@/app/actions/admin/adminQuoteIntakeDelivery";
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
  business?: string | string[];
  fee?: string | string[];
  zone?: string | string[];
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

function intakeDetails(payload: Record<string, unknown> | null) {
  if (!payload) return [];
  const record = (value: unknown): Record<string, unknown> =>
    value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const scalar = (value: unknown) =>
    typeof value === "string" ? value.trim().slice(0, 2000)
      : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
  const contact = record(payload.contact);
  const delivery = record(payload.delivery);
  const object = record(payload.object);
  const dates = record(payload.dates);
  const guests = record(payload.guests);
  const business = record(payload.business);
  const route = record(payload.route);
  const items = Array.isArray(payload.cart_items) ? payload.cart_items.slice(0, 30)
    .map((item) => { const row = record(item); return [scalar(row.title), scalar(row.quantity)].filter(Boolean).join(" × "); })
    .filter(Boolean).join("; ") : "";
  const rows: [string, unknown][] = [
    ["Имя", contact.name], ["Телефон", contact.phone], ["Email", contact.email],
    ["Что нужно", payload.requested_items], ["Позиции заявки", items],
    ["Получение", payload.delivery_method === "pickup" ? "Самовывоз" : payload.delivery_method === "delivery" ? "Доставка" : payload.delivery_method],
    ["Локация", delivery.location], ["Адрес", delivery.address],
    ["Оплата", payload.payment_preference === "cash" ? "Наличные" : payload.payment_preference === "transfer" ? "Перевод" : payload.payment_preference === "cash_or_transfer" ? "После подтверждения" : payload.payment_preference],
    ["Объект", object.title], ["Номер", object.room_title],
    ["Начало", dates.start], ["Окончание", dates.end],
    ["Взрослых", guests.adults], ["Детей", guests.children],
    ["Бизнес", business.name], ["Тип бизнеса", business.type], ["Локация бизнеса", business.location],
    ["Откуда", route.from], ["Куда", route.to], ["Дата трансфера", payload.date],
    ["Пассажиров", typeof payload.guests === "number" ? payload.guests : null],
    ["Комментарий", payload.comment]
  ];
  return rows.map(([label, value]) => ({ label, value: scalar(value) })).filter((row) => row.value);
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
        <div className="bg-linear-to-br from-slate-900 via-primary to-accent p-6 text-white">
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
              const details = intakeDetails(ticket.requestPayload);
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

                  {details.length > 0 ? (
                    <section className="mt-4 rounded-md border border-border p-4" data-intake-details={ticket.id}>
                      <h3 className="font-semibold text-foreground">Данные заявки</h3>
                      <p className="mt-1 text-sm text-muted">Пожелания клиента. Наличие, стоимость и условия требуют подтверждения оператором.</p>
                      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                        {details.map((detail) => (
                          <div className="min-w-0" key={detail.label}>
                            <dt className="text-muted">{detail.label}</dt>
                            <dd className="mt-1 whitespace-pre-wrap break-words text-foreground" translate="no">{detail.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  ) : null}

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
                      {ticket.category === "order_request" && ticket.createdBy && !ticket.relatedOrderId &&
                       (ticket.status === "open" || ticket.status === "in_progress") &&
                       Array.isArray(ticket.requestPayload?.cart_items) &&
                       ticket.requestPayload.cart_items.length > 0 ? (
                        <section className="grid gap-3">
                          {ticket.requestPayload?.delivery_method === "delivery" ? (
                            <form action={adminQuoteIntakeDeliveryAction} className="grid gap-3 rounded-md border border-border p-3" data-testid="admin-support-delivery-quote-form">
                              <input name="ticketId" type="hidden" value={ticket.id} />
                              <p className="text-sm font-semibold">Рассчитать стоимость доставки</p>
                              <p className="text-xs text-muted">Только утверждённый тариф в сомах из PostgreSQL. Адрес из заявки требует подтверждения оператором.</p>
                              <label className="grid gap-2 text-sm font-medium text-foreground">
                                ID партнёра
                                <input name="businessId" type="text" required minLength={36} maxLength={36}
                                  className="min-h-11 rounded-md border border-border bg-background px-3 py-2"
                                  defaultValue={first(params?.ticket) === ticket.id ? first(params?.business) : ""} />
                              </label>
                              <label className="grid gap-2 text-sm font-medium text-foreground">
                                Подтверждённая зона
                                <select name="zoneCode" required defaultValue={first(params?.ticket) === ticket.id ? first(params?.zone) || "cholpon-ata" : "cholpon-ata"}
                                  className="min-h-11 rounded-md border border-border bg-background px-3 py-2">
                                  <option value="cholpon-ata">Чолпон-Ата</option>
                                  <option value="bosteri">Бостери</option>
                                  <option value="karakol">Каракол</option>
                                  <option value="tamchy">Тамчы</option>
                                  <option value="baktuu-dolonotu">Бактуу-Долоноту</option>
                                  <option value="sary-oy">Сары-Ой</option>
                                </select>
                              </label>
                              <Button type="submit" variant="outline">Проверить тариф KGS</Button>
                              {first(params?.adminSupport) === "quote" && first(params?.ticket) === ticket.id ? (
                                <p className="text-sm font-semibold" role="status">
                                  Тариф по базе: {first(params?.fee)} сом. Перед подтверждением заказа будет пересчитан повторно.
                                </p>
                              ) : null}
                            </form>
                          ) : null}
                          <form action={adminSupportFormAction} className="grid gap-3 rounded-md border border-border p-3"
                            data-testid="admin-support-confirm-intake-order-form">
                            <input name="ticketId" type="hidden" value={ticket.id} />
                            <input name="action" type="hidden" value="confirm_order" />
                            <input name="requestId" type="hidden" value={`support-confirm-order-${randomUUID()}`} />
                            <p className="text-sm font-semibold">Создать подтверждённый заказ</p>
                            <p className="text-xs text-muted">
                              Только клиент с подтверждённым email, один партнёр и товары, доступные в базе.
                              Цена товаров и списание остатков рассчитываются PostgreSQL.
                              Оплата остаётся ожидающей до отдельного подтверждения.
                            </p>
                            <label className="grid gap-2 text-sm font-medium text-foreground">
                              ID утверждённого партнёра
                              <input name="businessId" type="text" required minLength={36} maxLength={36}
                                className="min-h-11 rounded-md border border-border bg-background px-3 py-2"
                                defaultValue={first(params?.ticket) === ticket.id ? first(params?.business) : ""} />
                            </label>
                            <label className="grid gap-2 text-sm font-medium text-foreground">
                              Подтверждённый тариф доставки, сом
                              <input name="confirmedDeliveryFee" type="number" step="0.01" min="0" max="100000" required
                                defaultValue={ticket.requestPayload?.delivery_method === "pickup" ? "0" :
                                  first(params?.ticket) === ticket.id && first(params?.adminSupport) === "quote"
                                    ? first(params?.fee) : ""}
                                className="min-h-11 rounded-md border border-border bg-background px-3 py-2" />
                            </label>
                            <label className="grid gap-2 text-sm font-medium text-foreground">
                              Как клиент подтвердил состав и стоимость заказа
                              <textarea name="confirmationNote" required minLength={8} maxLength={500}
                                className="min-h-20 rounded-md border border-border bg-background px-3 py-2" />
                            </label>
                            <Button type="submit">Подтвердить и создать заказ</Button>
                          </form>
                        <form action={adminSupportFormAction} className="grid gap-3 rounded-md border border-border p-3" data-testid="admin-support-intake-link-form">
                          <input name="ticketId" type="hidden" value={ticket.id} />
                          <input name="action" type="hidden" value="link_order" />
                          <input name="requestId" type="hidden" value={`support-link-${randomUUID()}`} />
                          <p className="text-sm font-semibold">Связать подтверждённый заказ с заявкой</p>
                          <p className="text-xs text-muted">
                            Только существующий заказ самовывоза, созданный самим авторизованным клиентом
                            с ключом intake-{ticket.id}. Состав и клиент проверяются PostgreSQL.
                            Эта операция не создаёт заказ и не включает доставку.
                          </p>
                          <label className="grid gap-2 text-sm font-medium text-foreground">
                            ID подтверждённого заказа
                            <input className="min-h-11 rounded-md border border-border bg-background px-3 py-2"
                              name="orderId" type="text" required minLength={36} maxLength={36}
                              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                          </label>
                          <Button type="submit" variant="outline">Связать существующий заказ</Button>
                        </form>
                        </section>
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

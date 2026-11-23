import { displayBusinessStatus } from "@/lib/i18n/status-labels";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { getAdminUserDirectoryReadResult, getManagedPartnerOptions } from "@/lib/data/admin-user-directory-supabase";
import { inviteManagedUserAction, updateManagedUserAccessAction } from "@/app/actions/admin/adminUserAccess";

export const dynamic = "force-dynamic";

type Params = { q?: string | string[]; access?: string };

export default async function AdminUsersPage({ searchParams }: { searchParams?: Promise<Params> }) {
  const params = await searchParams;
  const raw = Array.isArray(params?.q) ? params?.q[0] : params?.q;
  const q = typeof raw === "string" ? raw : "";
  const result = await getAdminUserDirectoryReadResult(q);
  const partners = result.ok ? await getManagedPartnerOptions() : [];

  return (
    <AdminLayout status={result.ok ? "stable" : "attention"}>
      <Card className="overflow-hidden">
        <div className="bg-linear-to-br from-slate-900 via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">KÖL · Пользователи</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Пользователи</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Реальные профили платформы. Доступ разрешён только владельцу платформы.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Поиск по электронной почте</CardTitle>
          <CardDescription>Показываются только записи из рабочей базы, не более 50 за один запрос.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {params?.access ? <p role="status" className="rounded-md border border-primary/30 bg-lake-light p-3 text-sm">
            {({
              invited: "Приглашение отправлено, роль и профиль сохранены.",
              updated: "Изменения доступа сохранены.",
              denied: "Недостаточно полномочий.",
              invalid: "Проверьте значения формы и причину.",
              invalid_scope: "Для партнёрской роли выберите существующий ID организации.",
              email_config: "Не задан безопасный адрес для почтового приглашения.",
              invite_failed: "Не удалось отправить письмо. Проверьте SMTP и адрес получателя.",
              provision_failed: "Не удалось подготовить доступ. Приглашение отменено.",
              protected: "Нельзя менять эту учётную запись или роль.",
              role_family: "Перевод между типами кабинетов требует отдельного переназначения организации.",
              update_failed: "Изменение не выполнено.",
              audit_failed: "Не удалось подтвердить изменение в журнале аудита."
            } as Record<string,string>)[params.access] || "Проверьте введённые данные."}
          </p> : null}
          <form action="/admin/users" method="get" className="flex max-w-2xl flex-wrap gap-2">
            <Input className="flex-1" type="search" name="q" defaultValue={q.slice(0, 64)}
              aria-label="Поиск пользователя по электронной почте" placeholder="Поиск по электронной почте" maxLength={64} />
            <Button type="submit">Найти</Button>
          </form>
          {!result.ok ? (
            <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm font-medium" role="status">
              {result.reason === "invalid_query" ? "Недопустимый поисковый запрос." :
                result.reason === "not_authorized" ? "Требуется учётная запись владельца платформы." :
                "Каталог пользователей временно недоступен: без подтверждённого доступа KÖL не показывает личные данные."}
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted">Найдено профилей: {result.total}. Показано: {result.items.length}.</p>
              {result.items.length === 0 ? <p className="text-sm text-muted">Совпадений нет.</p> :
                result.items.map(user => (
                  <article key={user.user_id} className="grid gap-2 rounded-md border border-border bg-background p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="min-w-0">
                      <p className="break-words font-semibold">{user.full_name || user.email || "Без имени"}</p>
                      <p className="break-words text-sm text-muted">{user.email || "Электронная почта не указана"}</p>
                      <p className="mt-1 text-xs text-muted">Роль: {user.role ?? "Не назначена"}</p>
                      <p className="mt-1 break-all text-xs text-muted">ID: {user.user_id}</p>
                      {user.role && ["dispatcher", "support_admin", "finance_admin", "courier", "content_manager", "partner_owner", "partner_manager", "partner_staff"].includes(user.role) ? (
                        <div className="mt-3 space-y-2">
                          <form action={updateManagedUserAccessAction} className="flex flex-wrap items-end gap-2">
                            <input type="hidden" name="user_id" value={user.user_id}/>
                            <input type="hidden" name="command" value={user.status === "blocked" ? "unblock" : "block"}/>
                            <Input className="min-w-44 flex-1" id="user-invite-reason" name="reason" minLength={5} maxLength={500} required placeholder="Причина изменения"/>
                            <Button type="submit">{user.status === "blocked" ? "Разблокировать" : "Заблокировать"}</Button>
                          </form>
                          {(user.role.startsWith("partner_") || ["dispatcher", "support_admin", "finance_admin", "content_manager"].includes(user.role)) ? (
                            <form action={updateManagedUserAccessAction} className="flex flex-wrap items-end gap-2">
                              <input type="hidden" name="user_id" value={user.user_id}/>
                              <input type="hidden" name="command" value="change_role"/>
                              <select name="role" required className="rounded-md border border-border bg-background p-2 text-sm">
                                {(user.role.startsWith("partner_")
                                  ? ["partner_owner", "partner_manager", "partner_staff"]
                                  : ["dispatcher", "support_admin", "finance_admin", "content_manager"]
                                ).map(role => <option key={role} value={role} disabled={role === user.role}>{role}</option>)}
                              </select>
                              <Input className="min-w-44 flex-1" id="user-invite-reason" name="reason" minLength={5} maxLength={500} required placeholder="Причина изменения роли"/>
                              <Button type="submit">Изменить роль</Button>
                            </form>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-2 sm:items-end">
                      <Badge variant={user.status === "active" ? "success" : "warning"}>{displayBusinessStatus(user.status)}</Badge>
                      <span className="text-xs text-muted">{new Date(user.created_at).toLocaleDateString("ru-RU")}</span>
                    </div>
                  </article>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Пригласить сотрудника или партнёра</CardTitle>
          <CardDescription>Клиентов создавать не требуется. Приглашение отправляется на email; нужен работающий SMTP в Supabase.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={inviteManagedUserAction} className="grid gap-3 sm:grid-cols-2">
            <label htmlFor="user-invite-full_name" className="grid gap-1 text-sm">Имя <Input id="user-invite-full_name" name="full_name" minLength={2} maxLength={120} required/></label>
            <label htmlFor="user-invite-email" className="grid gap-1 text-sm">Email <Input id="user-invite-email" name="email" type="email" maxLength={254} required/></label>
            <label htmlFor="user-invite-role" className="grid gap-1 text-sm">Роль
              <select id="user-invite-role" required name="role" className="rounded-md border border-border bg-background p-2">
                <option value="dispatcher">Диспетчер</option>
                <option value="support_admin">Поддержка</option>
                <option value="finance_admin">Финансы</option>
                <option value="content_manager">Контент-менеджер</option>
                <option value="courier">Курьер</option>
                <option value="partner_owner">Владелец партнёра</option>
                <option value="partner_manager">Менеджер партнёра</option>
                <option value="partner_staff">Сотрудник партнёра</option>
              </select>
            </label>
            <label htmlFor="user-invite-partner_id" className="grid gap-1 text-sm">Партнёрская организация (только для партнёрских ролей)
              <select id="user-invite-partner_id" name="partner_id" className="rounded-md border border-border bg-background p-2">
                <option value="">Не требуется для сотрудников KÖL</option>
                {partners.map(partner => <option key={partner.id} value={partner.id}>{partner.title}</option>)}
              </select>
              {partners.length === 0 ? <span className="text-xs text-muted">Партнёрских организаций пока нет. Сначала добавьте организацию.</span> : null}
            </label>
            <label htmlFor="user-invite-reason" className="grid gap-1 text-sm sm:col-span-2">Причина / основание приглашения
              <Input id="user-invite-reason" name="reason" minLength={5} maxLength={500} required placeholder="Например: договор с партнёром"/>
            </label>
            <div className="sm:col-span-2"><Button type="submit">Отправить приглашение</Button></div>
          </form>
        </CardContent>
      </Card>
      <Card className="border-primary/20 bg-lake-light">
        <CardHeader><CardTitle>Администрирование прав</CardTitle></CardHeader>
        <CardContent className="text-sm leading-6 text-muted">
          Только SUPER ADMIN может приглашать сотрудников и менять разрешённые роли. Клиенты регистрируются самостоятельно.
          Все изменения записываются в журнал. Перевод между типами кабинетов и создание ещё одного SUPER ADMIN
          требуют отдельной защищённой процедуры.
        </CardContent>
      </Card>
    </AdminLayout>
  );
}

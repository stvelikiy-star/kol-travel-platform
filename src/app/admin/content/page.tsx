import { redirect } from "next/navigation";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { requireSuperAdmin } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveSiteContent, publishSiteContent, restoreSiteContent } from "@/app/actions/admin/content";

export const dynamic = "force-dynamic";

type ContentRow = {
  id: string; content_key: string; locale: string; value: string;
  status: string; version: number; published_at: string | null;
};
type HistoryRow = {
  id: string; content_key: string; locale: string;
  value: string; version: number; published_at: string;
};

async function saveAndReturn(data: FormData): Promise<never> {
  "use server";
  const result = await saveSiteContent(data);
  redirect("/admin/content?result=" + (result.ok ? "saved" : "error") + "&code=" + result.code);
}
async function publishAndReturn(data: FormData): Promise<never> {
  "use server";
  const result = await publishSiteContent(data);
  redirect("/admin/content?result=" + (result.ok ? "published" : "error") + "&code=" + result.code);
}
async function restoreAndReturn(data: FormData): Promise<never> {
  "use server";
  const result = await restoreSiteContent(data);
  redirect("/admin/content?result=" + (result.ok ? "restored" : "error") + "&code=" + result.code);
}

const field = "w-full rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-hidden focus:border-primary";
function Stamp({children}: {children: React.ReactNode}) {
  return <span className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted">{children}</span>;
}
export default async function SiteContentAdminPage({
  searchParams
}: {searchParams: Promise<{result?:string;code?:string}>}) {
  const actor = await requireSuperAdmin();
  if (!actor.ok) redirect("/not-authorized");
  const supabase = await createSupabaseServerClient();
  const args = await searchParams;
  const [contents,history] = supabase
    ? await Promise.all([
        supabase.from("site_content")
          .select("id,content_key,locale,value,status,version,published_at")
          .order("content_key",{ascending:true}).limit(100),
        supabase.from("site_content_history")
          .select("id,content_key,locale,value,version,published_at")
          .order("published_at",{ascending:false}).limit(30)
      ])
    : [{data:null,error:{message:"offline"}},{data:null,error:{message:"offline"}}];
  const available = Boolean(supabase && !contents.error && !history.error);
  const rows = available ? ((contents.data ?? []) as ContentRow[]) : [];
  const versions = available ? ((history.data ?? []) as HistoryRow[]) : [];
  return (
    <AdminLayout status={available ? "stable" : "attention"}>
      <Card className="overflow-hidden">
        <div className="bg-linear-to-br from-lake-dark via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">KÖL · Content Control</Badge>
          <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">Управление содержимым сайта</h2>
          <p className="mt-2 text-sm leading-6 text-white/85">
            Тексты на RU / KG / EN, черновики и версии. Все изменения проверяются на сервере и записываются в журнал.
          </p>
        </div>
      </Card>
      {args.result ? (
        <Card className={args.result==="error"?"border-danger/40 bg-danger/10":"border-success/40 bg-success/10"}>
          <CardContent className="p-4 text-sm font-semibold">
            {args.result==="error" ? "Изменение отклонено. Данные не были опубликованы." :
            args.result==="saved"?"Черновик сохранён.":
            args.result==="published"?"Текст опубликован.":"Версия восстановлена."}
            {args.result==="error" && args.code ? <span className="ml-2 text-muted">{args.code}</span> : null}
          </CardContent>
        </Card>
      ) : null}
      {!available ? (
        <Card className="border-danger/40 bg-danger/10"><CardContent className="p-5 text-sm">
          Supabase недоступен или права не подтверждены. Редактирование сейчас отключено; демо-данные не подставляются.
        </CardContent></Card>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle>Создать или обновить черновик</CardTitle></CardHeader>
            <CardContent>
              <form action={saveAndReturn} className="grid gap-4">
                <label className="grid gap-2 text-sm font-semibold">Ключ блока
                  <input required minLength={3} maxLength={80} pattern="[a-z0-9_.-]+" name="content_key"
                    placeholder="home.hero.subtitle" className={field} />
                </label>
                <label className="grid gap-2 text-sm font-semibold">Язык
                  <select name="locale" className={field} defaultValue="ru">
                    <option value="ru">Русский</option>
                    <option value="ky">Кыргызча</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold">Текст
                  <textarea required maxLength={2000} rows={5} name="value"
                    className={field} placeholder="Введите содержание блока" />
                </label>
                <div><button type="submit"
                  className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white hover:opacity-90">
                  Сохранить черновик
                </button></div>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Черновики и опубликованные тексты</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {rows.length===0 ? <p className="text-sm text-muted">
                Контент из базы ещё не опубликован. Существующие страницы сайта остаются без изменений.
              </p> : rows.map(row=><div key={row.id}
                className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-border bg-background p-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="break-all text-sm">{row.content_key}</b><Stamp>{row.locale.toUpperCase()}</Stamp>
                    <Badge variant={row.status==="published"?"success":"warning"}>{row.status==="published"?"Опубликовано":"Черновик"}</Badge>
                    <Stamp>v{row.version}</Stamp>
                  </div>
                  <p className="whitespace-pre-wrap wrap-break-word text-sm text-muted">{row.value}</p>
                </div>
                {row.status==="draft"?<form action={publishAndReturn}>
                  <input type="hidden" name="content_key" value={row.content_key}/>
                  <input type="hidden" name="locale" value={row.locale}/>
                  <input type="hidden" name="version" value={row.version}/>
                  <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white">
                    Опубликовать v{row.version}
                  </button>
                </form>:null}
              </div>)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>История публикаций и восстановление</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {versions.length===0?<p className="text-sm text-muted">История пока пуста.</p>:
                versions.map(v=><div key={v.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{v.content_key} · {v.locale.toUpperCase()} · v{v.version}</p>
                    <p className="truncate text-xs text-muted">{v.value}</p>
                  </div>
                  <form action={restoreAndReturn}>
                    <input type="hidden" name="content_key" value={v.content_key}/>
                    <input type="hidden" name="locale" value={v.locale}/>
                    <input type="hidden" name="version" value={v.version}/>
                    <button type="submit" className="rounded-lg border border-primary px-3 py-2 text-xs font-semibold text-primary">
                      Восстановить
                    </button>
                  </form>
                </div>)}
            </CardContent>
          </Card>
        </>
      )}
    </AdminLayout>
  );
}

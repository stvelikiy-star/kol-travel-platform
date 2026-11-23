import Image from "next/image";
import { redirect } from "next/navigation";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { requireRole } from "@/lib/auth/roles";
import { requireActiveProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveSiteContent, publishSiteContent, restoreSiteContent } from "@/app/actions/admin/content";
import { uploadSiteVisual } from "@/app/actions/admin/siteVisuals";
import { safeSiteVisualUrl, safeSiteBannerLink } from "@/lib/data/home-visuals-read";

export const dynamic = "force-dynamic";

type ContentRow = {
  id: string; content_key: string; locale: string; value: string;
  status: string; version: number; published_at: string | null;
};
type HistoryRow = {
  id: string; content_key: string; locale: string;
  value: string; version: number; published_at: string;
};

async function returnPath(): Promise<string> {
  const current = await requireActiveProfile();
  return current.ok && current.data.role === "content_manager"
    ? "/editor/content" : "/admin/content";
}

async function saveAndReturn(data: FormData): Promise<never> {
  "use server";
  const result = await saveSiteContent(data);
  redirect((await returnPath()) + "?result=" + (result.ok ? "saved" : "error") + "&code=" + result.code);
}
async function publishAndReturn(data: FormData): Promise<never> {
  "use server";
  const result = await publishSiteContent(data);
  redirect((await returnPath()) + "?result=" + (result.ok ? "published" : "error") + "&code=" + result.code);
}
async function restoreAndReturn(data: FormData): Promise<never> {
  "use server";
  const result = await restoreSiteContent(data);
  redirect((await returnPath()) + "?result=" + (result.ok ? "restored" : "error") + "&code=" + result.code);
}

async function uploadAndReturn(data: FormData): Promise<never> {
  "use server";
  const result = await uploadSiteVisual(data);
  redirect((await returnPath()) + "?result=" + (result.ok ? "uploaded" : "error") + "&code=" + result.code);
}
async function saveBannerLinkAndReturn(data: FormData): Promise<never> {
  "use server";
  const value = String(data.get("banner_link") ?? "").trim();
  if (value.length > 1000 || (value !== "" && !safeSiteBannerLink(value))) {
    redirect((await returnPath()) + "?result=error&code=invalid_link");
  }
  const draft = new FormData();
  draft.set("content_key", "home.visual.banner_link");
  draft.set("locale", "ru");
  draft.set("value", value);
  const result = await saveSiteContent(draft);
  redirect((await returnPath()) + "?result=" + (result.ok ? "saved" : "error") + "&code=" + result.code);
}

const field = "w-full rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-hidden focus:border-primary";
function Stamp({children}: {children: React.ReactNode}) {
  return <span className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted">{children}</span>;
}
export default async function SiteContentAdminPage({
  searchParams
}: {searchParams: Promise<{result?:string;code?:string}>}) {
  const actor = await requireRole(["super_admin","content_manager"]);
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
  const visual = (key: string) => rows.find(row => row.content_key === key && row.locale === "ru" && row.status === "published");
  const visualDraft = (key: string) => rows.find(row => row.content_key === key && row.locale === "ru" && row.status === "draft");

  return (
    <AdminLayout status={available ? "stable" : "attention"}>
      <Card className="overflow-hidden">
        <div className="bg-linear-to-br from-lake-dark via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">KÖL · Управление контентом</Badge>
          <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">Управление содержимым сайта</h2>
          <p className="mt-2 text-sm leading-6 text-white/85">
            Тексты на RU / KG / EN, черновики и версии. Все изменения проверяются на сервере и записываются в журнал.
          </p>
        </div>
      </Card>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Показатели содержимого сайта">
        <div className="kol-adm-kpi kol-adm-kpi--info"><p className="kol-adm-kpi-label">Текстовых блоков</p><strong className="kol-adm-kpi-value">{available ? rows.length : "—"}</strong></div>
        <div className="kol-adm-kpi kol-adm-kpi--warning"><p className="kol-adm-kpi-label">Черновики</p><strong className="kol-adm-kpi-value">{available ? rows.filter((r) => r.status==="draft").length : "—"}</strong></div>
        <div className="kol-adm-kpi kol-adm-kpi--success"><p className="kol-adm-kpi-label">Опубликовано</p><strong className="kol-adm-kpi-value">{available ? rows.filter((r) => r.status==="published").length : "—"}</strong></div>
        <div className="kol-adm-kpi kol-adm-kpi--muted"><p className="kol-adm-kpi-label">Версий в истории</p><strong className="kol-adm-kpi-value">{available ? versions.length : "—"}</strong></div>
      </section>
      {args.result ? (
        <Card className={args.result==="error"?"border-danger/40 bg-danger/10":"border-success/40 bg-success/10"}>
          <CardContent className="p-4 text-sm font-semibold">
            {args.result==="error" ? "Изменение отклонено. Данные не были опубликованы." :
            args.result==="uploaded"?"Изображение загружено как черновик. Опубликуйте его после проверки.":
            args.result==="saved"?"Черновик сохранён.":
            args.result==="published"?"Текст опубликован.":"Версия восстановлена."}
            {args.result==="error" && args.code ? <span className="ml-2 text-muted">{args.code}</span> : null}
          </CardContent>
        </Card>
      ) : null}
      {!available ? (
        <Card className="border-danger/40 bg-danger/10"><CardContent className="p-5 text-sm">
          База данных недоступна или права пользователя не подтверждены. Редактирование сейчас отключено; демо-данные не подставляются.
        </CardContent></Card>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle>Оформление сайта: фон и баннер</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <p className="text-sm leading-6 text-muted">
                Загрузите изображение JPG, PNG или WebP размером до 4 МБ. Фон применяется к главной
                странице под контентом; утверждённая анимация остаётся. Баннер размещается после поиска.
                Загрузка сохраняет черновик, а сайт изменится только после публикации.
              </p>
              <div className="grid gap-5 lg:grid-cols-2">
                {([
                  ["background", "home.visual.background", "Фоновое изображение", "Рекомендуемый размер: 1920 × 1080"],
                  ["banner", "home.visual.banner", "Баннер главной", "Рекомендуемый размер: 1440 × 420"]
                ] as const).map(([kind,key,title,hint]) => {
                  const current = visual(key);
                  const draft = visualDraft(key);
                  const candidate = draft ?? current;
                  const src = candidate ? safeSiteVisualUrl(candidate.value) : null;
                  return <div key={kind} className="space-y-3 rounded-xl border border-border bg-background p-4">
                    <h3 className="text-base font-semibold">{title}</h3>
                    <p className="text-xs text-muted">{hint}</p>
                    {src ? (
                      <Image unoptimized width={800} height={350} src={src} alt={"Предпросмотр: " + title}
                        className="aspect-[16/7] w-full rounded-lg border border-border object-cover" />
                    ) : <div className="flex aspect-[16/7] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted">Изображение пока не загружено</div>}
                    <p className="text-xs text-muted">
                      {draft ? "Есть неопубликованный черновик" : current ? "Текущее опубликованное изображение" : "Используется стандартный дизайн"}
                    </p>
                    <form action={uploadAndReturn} className="space-y-3">
                      <input type="hidden" name="kind" value={kind} />
                      <input required type="file" name="file" accept="image/jpeg,image/png,image/webp"
                        className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-white" />
                      <button type="submit" className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white">
                        Загрузить {kind === "background" ? "фон" : "баннер"}
                      </button>
                    </form>
                    {draft ? <form action={publishAndReturn}>
                      <input type="hidden" name="content_key" value={key} />
                      <input type="hidden" name="locale" value="ru" />
                      <input type="hidden" name="version" value={draft.version} />
                      <button type="submit" className="rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary">
                        Опубликовать изображение
                      </button>
                    </form> : null}
                  </div>;
                })}
              </div>
              <div className="space-y-2 rounded-xl border border-border bg-background p-4">
                <h3 className="text-sm font-semibold">Ссылка баннера (необязательно)</h3>
                <p className="text-xs text-muted">Внутренняя ссылка вида /tours или защищённая ссылка https://. Сначала сохраните, затем опубликуйте черновик.</p>
                <form action={saveBannerLinkAndReturn} className="flex flex-col gap-3 sm:flex-row">
                  <input name="banner_link" type="text" maxLength={1000} className={field}
                    placeholder="/tours" defaultValue={visualDraft("home.visual.banner_link")?.value ?? visual("home.visual.banner_link")?.value ?? ""} />
                  <button type="submit" className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
                    Сохранить ссылку
                  </button>
                </form>
                {visualDraft("home.visual.banner_link") ? <form action={publishAndReturn}>
                  <input type="hidden" name="content_key" value="home.visual.banner_link" />
                  <input type="hidden" name="locale" value="ru" />
                  <input type="hidden" name="version" value={visualDraft("home.visual.banner_link")?.version} />
                  <button className="rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary" type="submit">
                    Опубликовать ссылку баннера
                  </button>
                </form> : null}
              </div>
            </CardContent>
          </Card>
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
                    <option value="en">Английский</option>
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

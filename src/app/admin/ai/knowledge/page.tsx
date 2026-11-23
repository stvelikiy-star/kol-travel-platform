import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { saveAiKnowledge, setAiKnowledgeStatus } from "@/app/actions/admin/aiKnowledge";
import { requireRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AiMaterial = {
  id:string;material_key:string;locale:string;kind:string;audience:string;
  title:string;body:string;source_url:string|null;priority:number;
  status:string;version:number;updated_at:string;
};
type History = { id:number;material_key:string;locale:string;version:number;status:string;changed_at:string };
const field="w-full min-w-0 rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground focus:border-primary focus:outline-hidden";
const kinds=[["faq","Вопрос и ответ"],["script","Точный скрипт"],["guide","Инструкция"],["policy","Правило"],["handoff","Передача сотруднику"]];
const audiences=[["public","Публичный"],["client","Клиент"],["partner","Партнёр"],["staff","Сотрудник"],["admin","Администратор"]];

export default async function KolAiKnowledgePage({searchParams}:{searchParams:Promise<{result?:string}>}) {
  const actor=await requireRole(["super_admin","content_manager"]);
  if(!actor.ok)redirect("/not-authorized");
  const base=actor.data.role==="content_manager"?"/editor/ai":"/admin/ai";
  const response=await searchParams;
  const supabase=await createSupabaseServerClient();
  const [list,history] = supabase
    ? await Promise.all([
      supabase.from("kol_ai_materials_v1")
        .select("id,material_key,locale,kind,audience,title,body,source_url,priority,status,version,updated_at")
        .order("updated_at",{ascending:false}).limit(150),
      supabase.from("kol_ai_material_versions_v1")
        .select("id,material_key,locale,version,status,changed_at")
        .order("changed_at",{ascending:false}).limit(30)
    ])
    : [{data:null,error:{message:"offline"}},{data:null,error:{message:"offline"}}];
  const available=Boolean(supabase&&!list.error&&!history.error);
  const rows=(available?(list.data??[]):[]) as AiMaterial[];
  const revisions=(available?(history.data??[]):[]) as History[];
  const localesByKey = new Map<string,Set<string>>();
  for (const item of rows) {
    if (!localesByKey.has(item.material_key)) localesByKey.set(item.material_key,new Set());
    localesByKey.get(item.material_key)?.add(item.locale);
  }
  const incompleteTranslations=Array.from(localesByKey.entries())
    .map(([key,present])=>({key,missing:["ru","ky","en"].filter(locale=>!present.has(locale))}))
    .filter(item=>item.missing.length>0);

  async function save(form:FormData) {
    "use server";
    const result=await saveAiKnowledge(form);
    const role=await requireRole(["super_admin","content_manager"]);
    const prefix=role.ok&&role.data.role==="content_manager"?"/editor/ai":"/admin/ai";
    redirect(prefix+"/knowledge?result="+encodeURIComponent(result.code));
  }
  async function status(form:FormData) {
    "use server";
    const result=await setAiKnowledgeStatus(form);
    const role=await requireRole(["super_admin","content_manager"]);
    const prefix=role.ok&&role.data.role==="content_manager"?"/editor/ai":"/admin/ai";
    redirect(prefix+"/knowledge?result="+encodeURIComponent(result.code));
  }

  const editor=(row?:AiMaterial)=><form action={save} className="grid gap-3">
    {row&&<><input type="hidden" name="id" value={row.id}/><input type="hidden" name="version" value={row.version}/></>}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-sm">Ключ знания
        <input required pattern="[a-z][a-z0-9_.-]{2,79}" maxLength={80} name="material_key" defaultValue={row?.material_key} placeholder="delivery.how_to_order" className={field}/>
      </label>
      <label className="grid gap-1 text-sm">Язык
        <select name="locale" className={field} defaultValue={row?.locale||"ru"}>
          <option value="ru">Русский</option><option value="ky">Кыргызча</option><option value="en">English</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm">Тип
        <select name="kind" className={field} defaultValue={row?.kind||"faq"}>
          {kinds.map(([key,title])=><option value={key} key={key}>{title}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm">Для кого
        <select name="audience" className={field} defaultValue={row?.audience||"public"}>
          {audiences.map(([key,title])=><option value={key} key={key}>{title}</option>)}
        </select>
      </label>
    </div>
    <label className="grid gap-1 text-sm">Заголовок
      <input required minLength={3} maxLength={150} name="title" className={field}
        defaultValue={row?.title} placeholder="Как оформить доставку?"/>
    </label>
    <label className="grid gap-1 text-sm">Точный текст ответа или инструкции
      <textarea required minLength={1} maxLength={8000} rows={6} name="body"
        className={field} defaultValue={row?.body}
        placeholder="Опишите утверждённый порядок действий. Не указывайте неподтверждённые цены, даты или номера телефонов."/>
    </label>
    <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
      <label className="grid gap-1 text-sm">Источник (ссылка необязательна)
        <input name="source_url" type="url" maxLength={600} className={field} defaultValue={row?.source_url||""} placeholder="https://..."/>
      </label>
      <label className="grid gap-1 text-sm">Приоритет
        <input name="priority" type="number" min={0} max={999} className={field} defaultValue={row?.priority??100}/>
      </label>
    </div>
    <p className="text-xs leading-5 text-muted">
      Сохранение создаёт черновик. Для использования в будущих ответах требуется отдельная публикация.
      При изменении опубликованного текста он снова станет черновиком.
    </p>
    <button disabled={!available} type="submit" className="w-fit rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">
      {row?"Сохранить новую версию":"Добавить черновик"}
    </button>
  </form>;

  return <AdminLayout status={available?"stable":"attention"}>
    <Link href={base} className="text-sm font-semibold text-primary">← Центр KÖL AI</Link>
    <Card>
      <CardHeader><CardTitle>База знаний и точные сценарии ответов</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm leading-6">
        <p>Все материалы имеют язык, аудиторию и статус публикации. Доступ к черновикам
          ограничен редакторами. ИИ пока выключен и не получает эти данные автоматически.</p>
        {response.result&&<div role="status" className="rounded-lg border border-border bg-lake-light p-3 font-semibold">
          Результат операции: {response.result==="saved"?"Черновик сохранён":response.result==="published"?"Материал опубликован":
          response.result==="archived"?"Материал отправлен в архив":
          response.result==="conflict_or_rejected"?"Изменение отклонено (возможно, версия устарела)":
          "Операция не выполнена: "+response.result}
        </div>}
        {!available&&<div className="rounded-lg border border-warning bg-warning/10 p-4">
          Хранилище знаний ещё не доступно в этом окружении. Формы заблокированы, демо-материалы не создаются.
        </div>}
      </CardContent>
    </Card>
    <Card><CardHeader><CardTitle>Добавить знание / скрипт / инструкцию</CardTitle></CardHeader>
      <CardContent>{editor()}</CardContent></Card>
    <Card>
      <CardHeader><CardTitle>Полнота переводов RU / KG / EN</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm leading-6">
        <p>
          Знания для клиентов нужно вести на трёх языках. Система не переводит
          утверждённые инструкции автоматически и не выдаёт непроверенный перевод за готовый.
        </p>
        <p className="font-semibold">
          {available
            ? incompleteTranslations.length===0 ? "Нет неполных групп перевода." :
              "Неполных групп: "+incompleteTranslations.length
            : "Проверка переводов недоступна без хранилища."}
        </p>
        {incompleteTranslations.slice(0,35).map(item=><p key={item.key} className="rounded-lg border border-warning/30 bg-warning/10 p-2">
          {item.key} — отсутствует: {item.missing.join(", ").toUpperCase()}
        </p>)}
      </CardContent>
    </Card>
    <section className="space-y-4">
      <h3 className="text-xl font-semibold">Материалы ({available?rows.length:"—"})</h3>
      {!rows.length&&<p className="text-sm text-muted">Пока нет записей. Начните с правил работы, подключения партнёра и передачи сложных обращений сотруднику.</p>}
      {rows.map(row=><Card key={row.id}>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="wrap-break-word">{row.title}</CardTitle>
            <Badge variant={row.status==="published"?"success":row.status==="archived"?"danger":"warning"}>
              {row.status==="published"?"Опубликовано":row.status==="archived"?"Архив":"Черновик"}
            </Badge>
            <Badge variant="info">{row.locale.toUpperCase()}</Badge>
            <Badge variant="info">{row.kind}</Badge>
            <Badge variant="info">{row.audience}</Badge>
          </div>
          <p className="text-xs text-muted">{row.material_key} · версия {row.version}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="whitespace-pre-wrap wrap-break-word text-sm leading-6">{row.body}</p>
          <div className="flex flex-wrap gap-2">
            {row.status!=="published"&&<form action={status}>
              <input type="hidden" name="id" value={row.id}/><input type="hidden" name="version" value={row.version}/>
              <input type="hidden" name="intent" value="publish"/>
              <button type="submit" className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white">Опубликовать</button>
            </form>}
            {row.status!=="archived"&&<form action={status}>
              <input type="hidden" name="id" value={row.id}/><input type="hidden" name="version" value={row.version}/>
              <input type="hidden" name="intent" value="archive"/>
              <button type="submit" className="rounded-lg border border-border px-3 py-2 text-sm">В архив</button>
            </form>}
          </div>
          <details className="rounded-xl border border-border bg-background p-4">
            <summary className="cursor-pointer font-semibold">Редактировать материал</summary>
            <div className="pt-4">{editor(row)}</div>
          </details>
        </CardContent>
      </Card>)}
    </section>
    <Card>
      <CardHeader><CardTitle>История изменений</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        {!revisions.length&&<p className="text-muted">История пока пуста.</p>}
        {revisions.map(item=><div className="flex flex-wrap justify-between gap-2 border-b border-border py-2" key={item.id}>
          <span>{item.material_key} · {item.locale.toUpperCase()} · v{item.version} · {item.status}</span>
          <time className="text-muted">{new Date(item.changed_at).toLocaleString("ru-RU",{timeZone:"Asia/Bishkek"})}</time>
        </div>)}
      </CardContent>
    </Card>
  </AdminLayout>;
}

import {redirect} from "next/navigation";
import {AdminLayout} from "@/components/layout/AdminLayout";
import {Badge} from "@/components/ui/Badge";
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from "@/components/ui/Card";
import {requireRole} from "@/lib/auth/roles";
import {requireActiveProfile} from "@/lib/auth/profile";
import {isSupabaseMode} from "@/lib/data/data-source";
import {createSupabaseServiceRoleClient} from "@/lib/supabase/service-role";
import {moderateReview,importVerifiedExternalReview} from "@/app/actions/admin/reviews";
export const dynamic="force-dynamic";
type Review={id:string;target_id:string;target_type:string;source:string;source_label:string|null;
 source_evidence_url:string|null;rating:number;text:string|null;status:string;hidden_reason:string|null;
 admin_reply:string|null;business_id:string;created_at:string};
async function returnPath(): Promise<string> {
  const current = await requireActiveProfile();
  return current.ok && current.data.role === "content_manager"
    ? "/editor/reviews" : "/admin/reviews";
}

async function moderate(form:FormData):Promise<never>{
 "use server";const r=await moderateReview(form);
 redirect((await returnPath())+"?result="+(r.ok?"saved":"error"));}
async function imported(form:FormData):Promise<never>{
 "use server";const r=await importVerifiedExternalReview(form);
 redirect((await returnPath())+"?result="+(r.ok?"saved":"error"));}
const field="w-full rounded-lg border border-border bg-surface p-3 text-sm";
export default async function AdminGuestReviewModeration({searchParams}:{
 searchParams:Promise<{result?:string}>
}){
 const owner=await requireRole(["super_admin","content_manager"]);if(!owner.ok)redirect("/not-authorized");
 const args=await searchParams;
 let available=false,rows:Review[]=[];
 if(isSupabaseMode()){try{
  const db=createSupabaseServiceRoleClient();
  const {data,error}=await db.from("reviews").select(
   "id,target_id,target_type,source,source_label,source_evidence_url,rating,text,status,hidden_reason,admin_reply,business_id,created_at")
   .order("created_at",{ascending:false}).limit(100);
  if(!error&&Array.isArray(data)){rows=data as Review[];available=true;}
 }catch{/* no fake reviews */}}
 const counts={new:rows.filter(x=>x.status==="new").length,
   published:rows.filter(x=>x.status==="published").length,
   hidden:rows.filter(x=>x.status==="hidden").length};
 return <AdminLayout status={available?"stable":"attention"}>
  <Card><CardHeader><Badge variant="info">KÖL · Reviews</Badge>
   <CardTitle>Модерация отзывов</CardTitle>
   <CardDescription>Отдельно настоящие отзывы после завершённой брони и отзывы из внешних источников.</CardDescription>
  </CardHeader><CardContent className="space-y-2 text-sm text-muted">
   <p>Рейтинг гостей формируется только из опубликованных собственных отзывов подтверждённых клиентов KÖL.</p>
   <p>Импорт внешнего отзыва требует ссылки на источник и не участвует в гостевом рейтинге.</p>
   <p>Исходный текст, автор, оценка и источник не изменяются модератором. Скрытие требует причины.</p>
  </CardContent></Card>
  {args.result?<Card><CardContent className="p-4 text-sm">{args.result==="saved"?
   "Решение зафиксировано в журнале.":"Действие отклонено; проверьте источник, права и решение."}
  </CardContent></Card>:null}
  {!available?<Card><CardContent className="p-4 text-sm">
   Очередь отзывов недоступна. Демонстрационные оценки не добавляются.
  </CardContent></Card>:(
   <>
    <section className="grid gap-3 sm:grid-cols-3" aria-label="Статистика модерации отзывов">
      <div className="kol-adm-kpi kol-adm-kpi--warning"><p className="kol-adm-kpi-label">Ожидают решения</p><strong className="kol-adm-kpi-value">{counts.new}</strong></div>
      <div className="kol-adm-kpi kol-adm-kpi--success"><p className="kol-adm-kpi-label">Опубликованы</p><strong className="kol-adm-kpi-value">{counts.published}</strong></div>
      <div className="kol-adm-kpi kol-adm-kpi--danger"><p className="kol-adm-kpi-label">Скрыты</p><strong className="kol-adm-kpi-value">{counts.hidden}</strong></div>
    </section>
    <Card><CardHeader><CardTitle>Проверка и ответ</CardTitle></CardHeader>
    <CardContent className="space-y-4">
     {!rows.length?<p className="text-sm text-muted">Отзывов пока нет.</p>:rows.map(r=>
      <div key={r.id} className="space-y-3 rounded-lg border border-border p-4 text-sm">
       <div className="flex flex-wrap items-center gap-2">
        <Badge variant={r.status==="published"?"success":r.status==="hidden"?"danger":"warning"}>
          {r.status}</Badge>
        <strong>{r.rating}★</strong>
        <Badge variant="info">{r.source==="site"?"Отзыв гостя KÖL":"Внешний источник"}</Badge>
        <span>{r.target_type} · {r.target_id}</span>
       </div>
       <p className="whitespace-pre-wrap text-foreground">{r.text}</p>
       {r.source!=="site"?<p className="text-muted">Источник: {r.source_label} ·
        {r.source_evidence_url?<a className="text-primary underline" rel="noopener noreferrer"
         target="_blank" href={r.source_evidence_url}>Проверить оригинал</a>:" Ссылка отсутствует"}</p>:null}
       <form action={moderate} className="grid gap-3">
        <input name="review_id" type="hidden" value={r.id}/>
        <label className="grid gap-2">Ответ администратора (необязательно)
         <textarea name="admin_reply" rows={2} maxLength={1000} className={field}
           defaultValue={r.admin_reply??""}/>
        </label>
        <label className="grid gap-2">Причина скрытия (если нужно)
         <select name="hidden_reason" defaultValue="other" className={field}>
          {[["spam","Спам"],["abuse","Оскорбление"],["off_topic","Не по теме"],
           ["personal_data","Персональные данные"],["wrong_object","Не тот объект"],
           ["duplicate","Дубликат"],["other","Другая причина"]].map(([v,label])=>
           <option value={v} key={v}>{label}</option>)}
         </select></label>
        <div className="flex flex-wrap gap-2">
         <button name="decision" type="submit" value="published"
          className="rounded-lg bg-primary px-4 py-2 font-semibold text-white">Опубликовать</button>
         <button name="decision" type="submit" value="hidden"
          className="rounded-lg border border-border px-4 py-2 font-semibold">Скрыть с причиной</button>
        </div>
       </form>
      </div>)}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Импорт проверенного внешнего отзыва</CardTitle>
     <CardDescription>Внешний отзыв нельзя выдавать за собственный отзыв гостя.</CardDescription>
    </CardHeader><CardContent>
     <form action={imported} className="grid gap-3">
      <label className="grid gap-1 text-sm">Тип объекта
       <select name="target_type" className={field}><option value="stay">Жильё</option>
        <option value="tour">Тур</option></select></label>
      <label className="grid gap-1 text-sm">ID объекта
       <input name="target_id" required className={field}/></label>
      <label className="grid gap-1 text-sm">ID бизнеса
       <input name="business_id" required className={field}/></label>
      <label className="grid gap-1 text-sm">Название источника
       <input name="source_label" required minLength={2} maxLength={160} className={field}/></label>
      <label className="grid gap-1 text-sm">Оригинальная ссылка HTTPS
       <input name="source_evidence_url" type="url" required className={field}/></label>
      <label className="grid gap-1 text-sm">Оценка 1–5
       <input name="rating" type="number" min={1} max={5} required className={field}/></label>
      <label className="grid gap-1 text-sm">Точный текст источника
       <textarea name="text" required minLength={3} maxLength={2000} className={field}/></label>
      <button type="submit" className="rounded-lg bg-primary px-4 py-3 font-semibold text-white">
       Импортировать как внешнее (на модерацию)</button>
     </form>
    </CardContent></Card>
   </>
  )}
 </AdminLayout>;
}

import {redirect} from "next/navigation";
import {AdminLayout} from "@/components/layout/AdminLayout";
import {Badge} from "@/components/ui/Badge";
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from "@/components/ui/Card";
import {requireRole} from "@/lib/auth/roles";
import {requireActiveProfile} from "@/lib/auth/profile";
import {isSupabaseMode} from "@/lib/data/data-source";
import {createSupabaseServiceRoleClient} from "@/lib/supabase/service-role";
import {setEditorialListingScore,createListingPromotion,confirmListingPromotionPayment,setPromotionActive} from "@/app/actions/admin/ranking";
import { PositionStepper } from "@/components/admin/PositionStepper";

export const dynamic="force-dynamic";
type Target={id:string;title:string;business_id:string};
type Editorial={id:string;target_type:string;target_id:string;score:number;note:string|null};
type Promotion={id:string;target_type:string;target_id:string;label:string;position:number;
 price_kgs:number;payment_status:string;is_active:boolean};
const field="w-full rounded-lg border border-border bg-surface p-3 text-sm";
async function returnPath(): Promise<string> {
  const current = await requireActiveProfile();
  return current.ok && current.data.role === "content_manager"
    ? "/editor/ranking" : "/admin/ranking";
}

async function saveScore(f:FormData):Promise<never>{"use server";const x=await setEditorialListingScore(f);
 redirect((await returnPath())+"?result="+(x.ok?"saved":"error"));}
async function addPromotion(f:FormData):Promise<never>{"use server";const x=await createListingPromotion(f);
 redirect((await returnPath())+"?result="+(x.ok?"saved":"error"));}
async function confirm(f:FormData):Promise<never>{"use server";const x=await confirmListingPromotionPayment(f);
 redirect((await returnPath())+"?result="+(x.ok?"saved":"error"));}
async function toggle(f:FormData):Promise<never>{"use server";const x=await setPromotionActive(f);
 redirect((await returnPath())+"?result="+(x.ok?"saved":"error"));}
export default async function AdminRanking({searchParams}:{searchParams:Promise<{result?:string}>}){
 const actor=await requireRole(["super_admin","content_manager"]);if(!actor.ok)redirect("/not-authorized");
 const params=await searchParams;
 let available=false,stays:Target[]=[],tours:Target[]=[],scores:Editorial[]=[],promos:Promotion[]=[];
 if(isSupabaseMode()){try{
   const db=createSupabaseServiceRoleClient();
   const [s,t,e,p]=await Promise.all([
     db.from("stays").select("id,title,business_id").order("title").limit(100),
     db.from("tours").select("id,title,business_id").order("title").limit(100),
     db.from("editorial_scores").select("id,target_type,target_id,score,note").limit(100),
     db.from("listing_promotions").select("id,target_type,target_id,label,position,price_kgs,payment_status,is_active")
       .order("created_at",{ascending:false}).limit(100)
   ]);
   if(!s.error&&!t.error&&!e.error&&!p.error){
    stays=(s.data??[]) as Target[];tours=(t.data??[]) as Target[];
    scores=(e.data??[]) as Editorial[];promos=(p.data??[]) as Promotion[];available=true;
   }
  }catch{/* fail closed */}}
 const listings=[...stays.map(x=>({...x,type:"stay"})),...tours.map(x=>({...x,type:"tour"}))];
 return <AdminLayout status={available?"stable":"attention"}>
  <Card><CardHeader><Badge variant="info">KÖL · Ranking</Badge>
   <CardTitle>Оценки редакции и продвижение</CardTitle>
   <CardDescription>Оценка редакции KÖL, рейтинг настоящих гостей и реклама — разные показатели.</CardDescription>
  </CardHeader><CardContent className="space-y-2 text-sm text-muted">
    <p>Оплаченная позиция помечается «Реклама». Платное продвижение не меняет оценку гостей.</p>
    <p>Оплату по документу подтверждает владелец или менеджер контента; это не доказательство банковской сверки и не запись дохода.</p>
  </CardContent></Card>
  <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Показатели редакции и продвижения">
    <div className="kol-adm-kpi kol-adm-kpi--info"><p className="kol-adm-kpi-label">Объектов каталога</p><strong className="kol-adm-kpi-value">{available ? listings.length : "—"}</strong></div>
    <div className="kol-adm-kpi kol-adm-kpi--muted"><p className="kol-adm-kpi-label">Оценок редакции</p><strong className="kol-adm-kpi-value">{available ? scores.length : "—"}</strong></div>
    <div className="kol-adm-kpi kol-adm-kpi--warning"><p className="kol-adm-kpi-label">Продвижений</p><strong className="kol-adm-kpi-value">{available ? promos.length : "—"}</strong></div>
    <div className="kol-adm-kpi kol-adm-kpi--success"><p className="kol-adm-kpi-label">Активных размещений</p><strong className="kol-adm-kpi-value">{available ? promos.filter((x) => x.is_active).length : "—"}</strong></div>
  </section>
  {params.result?<Card><CardContent className="p-4 text-sm">{params.result==="saved"?
   "Действие принято и записано в аудит.":"Действие отклонено: проверьте права, объект и оплату."}
  </CardContent></Card>:null}
  {!available?<Card><CardContent className="p-5 text-sm">
    Данные рейтингов недоступны; демонстрационные оценки не подставляются.
  </CardContent></Card>:(
   <>
    <Card><CardHeader><CardTitle>Оценка редакции KÖL</CardTitle>
     <CardDescription>Отдельна от подтверждённых отзывов гостей.</CardDescription>
    </CardHeader><CardContent>
     <form action={saveScore} className="grid gap-3">
      <select name="target_type" className={field} defaultValue="stay">
       <option value="stay">Жильё</option><option value="tour">Тур</option></select>
      <label className="grid gap-1 text-sm">Объект (из действующего каталога)
       <select name="target_id" className={field} required defaultValue="">
        <option value="" disabled>Выберите объект</option>
        {listings.map(x=><option key={x.type+":"+x.id} value={x.id}>
         {x.type==="stay"?"Жильё":"Тур"} · {x.title}</option>)}
       </select>
      </label>
      <label className="grid gap-1 text-sm">Редакционный балл (1–5)
       <input type="number" name="score" min={1} max={5} step="0.1" required className={field}/>
      </label>
      <label className="grid gap-1 text-sm">Редакционное основание
       <textarea name="note" maxLength={1500} rows={2} className={field}/></label>
      <button type="submit" className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white">
       Сохранить оценку редакции</button>
     </form>
     <p className="mt-4 text-sm text-muted">Оценок редакции: {scores.length}.</p>
     {scores.map(x=><p key={x.id} className="rounded-lg border border-border p-3 text-sm">
       {x.target_type}: {x.target_id} · {x.score}/5 — Оценка редакции KÖL
      </p>)}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Продвижение объектов</CardTitle>
     <CardDescription>Бесплатная рекомендация и платная реклама не смешиваются.</CardDescription>
    </CardHeader><CardContent className="space-y-4">
     <form action={addPromotion} className="grid gap-3">
      <select name="target_type" defaultValue="stay" className={field}>
       <option value="stay">Жильё</option><option value="tour">Тур</option></select>
      <label className="grid gap-1 text-sm">Объект
       <select name="target_id" defaultValue="" required className={field}>
        <option value="" disabled>Выберите объект</option>
        {listings.map(x=><option key={x.type+":"+x.id} value={x.id}>
         {x.type==="stay"?"Жильё":"Тур"} · {x.title}</option>)}
       </select></label>
      <label className="grid gap-1 text-sm">Тип
       <select name="label" className={field}>
        <option value="recommended">Рекомендация редакции (без оплаты)</option>
        <option value="ad">Реклама (с маркировкой)</option></select></label>
      <div className="grid gap-1 text-sm"><span>Позиция (1–50)</span>
       <PositionStepper className={field}/>
      </div>
      <label className="grid gap-1 text-sm">Цена размещения в сомах (0 для рекомендации)
       <input name="price_kgs" type="number" min={0} step="0.01" defaultValue={0} required className={field}/>
      </label>
      <button type="submit" className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white">
       Создать неактивное продвижение</button>
     </form>
     {promos.map(x=><div key={x.id} className="space-y-2 rounded-lg border border-border p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2"><b>{x.target_type} · {x.target_id}</b>
       <Badge variant={x.is_active?"success":"muted"}>{x.is_active?"Активно":"Неактивно"}</Badge>
       <Badge variant="info">{x.label==="ad"?"Реклама":"Рекомендация"}</Badge>
      </div>
      <p className="flex flex-wrap items-center gap-2">
        <Badge variant="info">Порядок: {x.position}</Badge>
        <span>Цена {x.price_kgs} KGS · оплата: {x.payment_status}</span>
      </p>
      {x.price_kgs>0&&x.payment_status!=="paid"?<form action={confirm} className="flex flex-wrap gap-2">
       <input name="promotion_id" type="hidden" value={x.id}/>
       <input name="payment_evidence" required minLength={8} maxLength={500}
        placeholder="Документ оплаты" className={field}/>
       <button className="rounded-lg border border-primary p-3 text-primary">Подтвердить по документу</button>
      </form>:null}
      <form action={toggle} className="flex flex-wrap gap-2">
       <input name="promotion_id" type="hidden" value={x.id}/>
       <input name="is_active" type="hidden" value={x.is_active?"false":"true"}/>
       <button className="rounded-lg border border-primary px-3 py-2 text-primary" type="submit">
        {x.is_active?"Отключить":"Включить"} размещение</button>
      </form>
     </div>)}
    </CardContent></Card>
   </>
  )}
 </AdminLayout>;
}

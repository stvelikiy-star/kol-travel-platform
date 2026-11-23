import {redirect} from "next/navigation";
import {AdminLayout} from "@/components/layout/AdminLayout";
import {Badge} from "@/components/ui/Badge";
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from "@/components/ui/Card";
import {requireRole} from "@/lib/auth/roles";
import {requireActiveProfile} from "@/lib/auth/profile";
import {isSupabaseMode} from "@/lib/data/data-source";
import {createSupabaseServiceRoleClient} from "@/lib/supabase/service-role";
import {createAdDraft,setAdCampaignStatus,confirmAdPaymentByOwner} from "@/app/actions/admin/ads";

export const dynamic="force-dynamic";
type Campaign={id:string;slot_code:string;advertiser_name:string;title_ru:string;
 starts_at:string;ends_at:string;status:string;price_kgs:number;payment_status:string};
type Slot={code:string;title:string};
async function returnPath(): Promise<string> {
  const current = await requireActiveProfile();
  return current.ok && current.data.role === "content_manager"
    ? "/editor/ads" : "/admin/ads";
}

async function create(form:FormData):Promise<never>{
 "use server";
 const r=await createAdDraft(form);redirect((await returnPath())+"?result="+(r.ok?"saved":"error"));
}
async function update(form:FormData):Promise<never>{
 "use server";
 const r=await setAdCampaignStatus(form);redirect((await returnPath())+"?result="+(r.ok?"saved":"error"));
}
async function confirm(form:FormData):Promise<never>{
 "use server";
 const r=await confirmAdPaymentByOwner(form);redirect((await returnPath())+"?result="+(r.ok?"saved":"error"));
}
const field="w-full rounded-lg border border-border bg-surface p-3 text-sm";
export default async function AdminAdsPage({searchParams}:{
 searchParams:Promise<{result?:string}>
}){
 const actor=await requireRole(["super_admin","content_manager"]);
 if(!actor.ok)redirect("/not-authorized");
 const args=await searchParams;
 let campaigns:Campaign[]=[],slots:Slot[]=[];let available=false;
 if(isSupabaseMode()){
  try{
   const db=createSupabaseServiceRoleClient();
   const [c,s]=await Promise.all([
    db.from("site_ad_campaigns")
      .select("id,slot_code,advertiser_name,title_ru,starts_at,ends_at,status,price_kgs,payment_status")
      .order("created_at",{ascending:false}).limit(100),
    db.from("site_ad_slots").select("code,title").eq("is_active",true).order("code")
   ]);
   if(!c.error&&!s.error){
    campaigns=(c.data??[]) as Campaign[];slots=(s.data??[]) as Slot[];available=true;
   }
  }catch{/* no dummy data */}
 }
 return <AdminLayout status={available?"stable":"attention"}>
  <Card><CardHeader><Badge variant="info">KÖL · Ads</Badge>
   <CardTitle>Реклама и рекламные места</CardTitle>
   <CardDescription>Заявки, согласование, подтверждение оплаты и публикация с обязательной маркировкой.</CardDescription>
  </CardHeader>
   <CardContent className="text-sm text-muted">
    Подтверждение по документу выполняет владелец или контент-менеджер. Отметка не означает банковскую сверку
    и не создаёт бухгалтерскую выручку KÖL. Показы и клики без подтверждённой телеметрии не считаются.
   </CardContent>
  </Card>
  <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Показатели рекламы">
    <div className="kol-adm-kpi kol-adm-kpi--info"><p className="kol-adm-kpi-label">Рекламных мест</p><strong className="kol-adm-kpi-value">{available ? slots.length : "—"}</strong></div>
    <div className="kol-adm-kpi kol-adm-kpi--muted"><p className="kol-adm-kpi-label">Кампаний</p><strong className="kol-adm-kpi-value">{available ? campaigns.length : "—"}</strong></div>
    <div className="kol-adm-kpi kol-adm-kpi--success"><p className="kol-adm-kpi-label">Активных кампаний</p><strong className="kol-adm-kpi-value">{available ? campaigns.filter((c) => c.status==="active").length : "—"}</strong></div>
    <div className="kol-adm-kpi kol-adm-kpi--warning"><p className="kol-adm-kpi-label">Оплата по документу</p><strong className="kol-adm-kpi-value">{available ? campaigns.filter((c) => c.payment_status==="paid").length : "—"}</strong></div>
  </section>
  {args.result?<Card><CardContent className="p-4 text-sm">
   {args.result==="saved"?"Изменение зафиксировано и прошло проверку прав.":
     "Действие отклонено: проверьте сроки, оплату, права и основание."}
  </CardContent></Card>:null}
  {!available?<Card><CardContent className="p-4 text-sm">
    Сервер рекламных кампаний недоступен. Демонстрационные кампании не выводятся.
  </CardContent></Card>:(
   <>
    <Card className="kol-adm-feature">
      <CardHeader><CardTitle>Доступные рекламные места</CardTitle>
        <CardDescription>Только опубликованные настройки мест из каталога, без вымышленных показов или рекламодателей.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {slots.length===0?<p className="text-sm text-muted">Активных рекламных мест пока нет.</p>:
          slots.map((slot)=><div key={slot.code} className="kol-adm-slot">
            <Badge variant="info">Рекламное место</Badge>
            <p className="mt-3 text-base font-semibold text-foreground">{slot.title}</p>
            <p className="mt-1 text-xs text-muted">{slot.code}</p>
          </div>)}
      </CardContent>
    </Card>
    <Card><CardHeader><CardTitle>Новая кампания · черновик</CardTitle>
      <CardDescription>Время указывается по Бишкеку (+06:00). Никаких автопубликаций без оплаты.</CardDescription>
    </CardHeader><CardContent>
     <form action={create} className="grid gap-4">
      <label className="grid gap-2 text-sm">Рекламное место
       <select name="slot_code" required className={field}>
        {slots.map(x=><option value={x.code} key={x.code}>{x.title}</option>)}
       </select>
      </label>
      <label className="grid gap-2 text-sm">Рекламодатель
       <input name="advertiser_name" required minLength={2} maxLength={160} className={field}/>
      </label>
      <label className="grid gap-2 text-sm">Заголовок RU
       <input name="title_ru" required maxLength={120} className={field}/>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
       <label className="grid gap-2 text-sm">Заголовок KG
        <input name="title_ky" maxLength={120} className={field}/>
       </label>
       <label className="grid gap-2 text-sm">Заголовок EN
        <input name="title_en" maxLength={120} className={field}/>
       </label>
      </div>
      <label className="grid gap-2 text-sm">Ссылка на сайт или внутреннюю страницу
       <input name="link_url" placeholder="/stays" className={field}/>
      </label>
      <label className="grid gap-2 text-sm">Картинка из медиатеки (необязательно)
       <input name="image_path" placeholder="/media/kol/..." className={field}/>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
       <label className="grid gap-2 text-sm">Начало
        <input name="starts_at" type="datetime-local" required className={field}/>
       </label>
       <label className="grid gap-2 text-sm">Окончание
        <input name="ends_at" type="datetime-local" required className={field}/>
       </label>
      </div>
      <label className="grid gap-2 text-sm">Цена размещения в сомах
       <input name="price_kgs" type="number" min={0} step="0.01" defaultValue="0" required className={field}/>
      </label>
      <div><button type="submit" className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white">
       Создать черновик
      </button></div>
     </form>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Кампании ({campaigns.length})</CardTitle>
      <CardDescription>Платную рекламу нельзя активировать без подтверждённого основания оплаты.</CardDescription>
    </CardHeader><CardContent className="space-y-3">
     {campaigns.length===0?<p className="text-sm text-muted">Кампаний пока нет.</p>:
      campaigns.map(c=><div key={c.id} className="space-y-3 rounded-lg border border-border bg-background p-4">
       <div className="flex flex-wrap items-center gap-2 text-sm">
        <b>{c.title_ru}</b>
        <Badge variant={c.status==="active"?"success":"warning"}>{c.status}</Badge>
        <Badge variant={c.payment_status==="paid"?"success":"muted"}>
         {c.payment_status==="paid"?"Оплата подтверждена по документу":"Оплата не подтверждена"}
        </Badge>
       </div>
       <p className="text-sm text-muted">{c.advertiser_name} · {c.slot_code} · {c.price_kgs} KGS</p>
       <p className="text-xs text-muted">Период: {c.starts_at} — {c.ends_at}</p>
       {c.payment_status!=="paid"&&c.price_kgs>0?<form action={confirm} className="flex flex-wrap gap-2">
        <input type="hidden" name="campaign_id" value={c.id}/>
        <input name="payment_evidence" required minLength={8} maxLength={500}
         placeholder="Документ и основание оплаты" className={field}/>
        <button type="submit" className="rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary">
         Подтвердить по документу
        </button>
       </form>:null}
       <form action={update} className="flex flex-wrap gap-2">
        <input type="hidden" name="campaign_id" value={c.id}/>
        <select name="status" defaultValue={c.status} className={field}>
         {["draft","review","active","paused","ended"].map(s=>
          <option value={s} key={s}>{s}</option>)}
        </select>
        <button type="submit" className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white">
         Сохранить статус
        </button>
       </form>
      </div>)}
    </CardContent></Card>
   </>
  )}
 </AdminLayout>;
}

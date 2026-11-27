import "server-only";
import {isSupabaseMode} from "@/lib/data/data-source";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {isAssistantPreviewEnabled} from "@/lib/assistant/preview-gate";
import {getPublicStaysReadResult} from "@/lib/data/public-stays-read";
import {getPublicToursReadResult} from "@/lib/data/public-tours-read";

export type AssistantLocale="ru"|"ky"|"en";
type Article={title:string;body:string;source:string|null};
type Listing={title:string;location:string;href:string;kind:"stay"|"tour"};
export type AssistantReply={kind:"knowledge";articles:Article[]}|{kind:"catalog";listings:Listing[]}|{kind:"handoff"|"unavailable"|"not_found"};
const words=(v:string)=>Array.from(new Set(v.toLowerCase().normalize("NFKC").match(/[a-zа-яёңөү0-9]{3,40}/gi)??[]));
const generic=new Set(["как","что","где","мне","можно","пожалуйста","есть","какие","для","это","the","how","what","where","can","you","please","with","for","are","мен","кантип","кайда","эмне","болот","үчүн"]);
function matches(query:string,source:string){const terms=words(query).filter(x=>!generic.has(x));const value=source.toLowerCase().normalize("NFKC");return terms.filter(term=>value.includes(term)).length;}
function safeSource(v:unknown):string|null{
 if(typeof v!=="string"||v.length>600)return null;
 try{const u=new URL(v);return u.protocol==="https:"&&!u.username&&!u.password?u.href:null;}catch{return null;}
}
const sensitive=/(возврат|оплат|плат[её]ж|жалоб|спор|отмен|парол|чуж|статус.*заказ|статус.*брон|refund|payment|cancel|complaint|password|my (order|booking)|order status|booking status|кайтар|төлөм|даттан|сырсөз|жокко чыгар|менин брон)/i;
export async function findPublicAssistantReply(locale:AssistantLocale,question:string):Promise<AssistantReply>{
 if(!["ru","ky","en"].includes(locale)||typeof question!=="string"||question.length>240||question.trim().length<3)return {kind:"not_found"};
 if(sensitive.test(question))return {kind:"handoff"};
 if(!isAssistantPreviewEnabled()||!isSupabaseMode())return {kind:"unavailable"};
 const query=question.trim();
 try{
  const db=await createSupabaseServerClient();
  if(!db)return {kind:"unavailable"};
  const {data,error}=await db.from("kol_ai_materials_v1").select("title,body,source_url,locale,audience,status,kind,priority")
    .eq("locale",locale).eq("audience","public").eq("status","published").in("kind",["faq","script","guide","policy"])
    .order("priority",{ascending:true}).limit(100);
  if(error||!Array.isArray(data))return {kind:"unavailable"};
  const ranked=data.filter(r=>r.locale===locale&&r.audience==="public"&&r.status==="published"&&["faq","script","guide","policy"].includes(r.kind)&&typeof r.title==="string"&&typeof r.body==="string")
    .map(r=>({r,score:matches(query,r.title)*3+matches(query,r.body)})).filter(x=>x.score>=3).sort((a,b)=>b.score-a.score);
  if(ranked.length)return {kind:"knowledge",articles:ranked.slice(0,2).map(({r})=>({title:r.title,body:r.body,source:safeSource(r.source_url)}))};
  const stay=/(жиль|отел|гостиниц|номер|коттедж|турак|мейманкана|hotel|stay|accommodation|room|guesthouse)/i.test(query);
  const tour=/(тур|экскурс|саякат|tour|excursion|trip)/i.test(query);
  if(stay||tour){
   const listings:Listing[]=[];
   if(stay){
    const result=await getPublicStaysReadResult();
    if(result.source!=="supabase"||(!result.ok&&result.code!=="empty_result"))return {kind:"unavailable"};
    for(const row of result.items)if(row.status==="active"&&row.slug)listings.push({title:row.title,location:row.location,href:"/stays/"+encodeURIComponent(row.slug),kind:"stay"});
   }
   if(tour){
    const result=await getPublicToursReadResult();
    if(result.source!=="supabase"||(!result.ok&&result.code!=="empty_result"))return {kind:"unavailable"};
    for(const row of result.items)if(row.status==="active"&&row.slug)listings.push({title:row.title,location:row.location,href:"/tours/"+encodeURIComponent(row.slug),kind:"tour"});
   }
   const specific=listings.map(row=>({row,score:matches(query,row.title+" "+row.location)})).sort((a,b)=>b.score-a.score);
   const found=specific.filter(x=>x.score>0);
   // Generic or unsupported criteria go to the full catalogue, not a false match.
   if(!found.length)return {kind:"not_found"};
   return found.length?{kind:"catalog",listings:found.slice(0,4).map(x=>x.row)}:{kind:"not_found"};
  }
  return {kind:"not_found"};
 }catch{return {kind:"unavailable"};}
}

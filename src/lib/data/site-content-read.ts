import "server-only";

import { isSupabaseMode } from "@/lib/data/data-source";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SiteLocale = "ru" | "ky" | "en";
export type PublishedSiteText = { value: string; source: "database" | "fallback" };
export type PublicAd = {
  id: string; slot_code: string; title_ru: string; title_ky: string | null;
  title_en: string | null; image_path: string | null; link_url: string | null;
  disclosure_label: string;
};
export type PublicPromotion = {
  id: string; target_type: "stay" | "tour"; target_id: string;
  position: number; label: "none" | "recommended" | "ad";
};
export type PublicGuestRating = {
  target_type: string; target_id: string; guest_rating: number; review_count: number;
};

const keyPattern = /^[a-z0-9_.-]{3,80}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const slots = new Set(["top_strip", "home_between", "catalog_inline", "detail_side", "cart_banner"]);

export async function getPublishedSiteText(
  key: string, locale: SiteLocale, fallback: string
): Promise<PublishedSiteText> {
  const unavailable: PublishedSiteText = {value:fallback,source:"fallback"};
  if (!isSupabaseMode() || !keyPattern.test(key) || !["ru","ky","en"].includes(locale)) return unavailable;
  try {
    const client = await createSupabaseServerClient();
    if (!client) return unavailable;
    const { data, error } = await client.from("site_content").select("value")
      .eq("content_key",key).eq("locale",locale).eq("status","published").maybeSingle();
    if (error || typeof data?.value!=="string") return unavailable;
    return {value:data.value,source:"database"};
  } catch { return unavailable; }
}

function safeAdUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") && !/[\u0000-\u001f]/.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol==="https:" && !!url.hostname && !url.username && !url.password ? url.toString() : null;
  } catch {return null;}
}

export async function getActiveAdSlot(slot: string): Promise<PublicAd | null> {
  if (!isSupabaseMode() || !slots.has(slot)) return null;
  try {
    const client = await createSupabaseServerClient();
    if (!client) return null;
    const {data,error}=await client.from("site_ad_campaigns")
      .select("id,slot_code,title_ru,title_ky,title_en,image_path,link_url,disclosure_label")
      .eq("slot_code",slot).eq("status","active").order("priority",{ascending:true}).limit(1).maybeSingle();
    if (error||!data||typeof data.title_ru!=="string"||typeof data.disclosure_label!=="string")return null;
    const link=safeAdUrl(data.link_url);
    if (data.link_url!==null && !link) return null;
    return {...data,link_url:link} as PublicAd;
  } catch {return null;}
}

export async function getActivePromotions(type: "stay"|"tour"): Promise<PublicPromotion[]> {
  if (!isSupabaseMode() || !["stay","tour"].includes(type)) return [];
  try {
    const client=await createSupabaseServerClient();
    if(!client)return [];
    const {data,error}=await client.from("listing_promotions")
      .select("id,target_type,target_id,position,label")
      .eq("target_type",type).eq("is_active",true)
      .order("position",{ascending:true}).limit(100);
    if(error||!Array.isArray(data))return [];
    return data.filter((v):v is PublicPromotion=>v.target_type===type&&
      typeof v.target_id==="string"&&uuidPattern.test(v.target_id)&&
      Number.isInteger(v.position)&&v.position>=1&&v.position<=50&&
      ["none","recommended","ad"].includes(v.label));
  }catch{return [];}
}

export async function getVerifiedGuestRatings(type:"stay"|"tour", ids:string[]):Promise<PublicGuestRating[]>{
  if(!isSupabaseMode()||ids.length===0||ids.length>100||ids.some(x=>!uuidPattern.test(x)))return [];
  try {
    const client=await createSupabaseServerClient();if(!client)return [];
    const {data,error}=await client.from("public_listing_ratings")
      .select("target_type,target_id,guest_rating,review_count")
      .eq("target_type",type).in("target_id",ids);
    if(error||!Array.isArray(data))return [];
    const safe=new Set(ids);
    return data.filter((v):v is PublicGuestRating=>v.target_type===type&&safe.has(v.target_id)&&
       typeof v.guest_rating==="number"&&Number.isFinite(v.guest_rating)&&
       typeof v.review_count==="number"&&Number.isInteger(v.review_count)&&v.review_count>0);
  }catch{return [];}
}

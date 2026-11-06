"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Locale = "ru" | "ky" | "en";
const wording = {
  ru: { teaser:"Я тут, если что", title:"Помощник KÖL", welcome:"Привет! Помогу найти нужный раздел КЁЛь.", limit:"Пока доступна навигация по сайту. ИИ-диалог ещё не подключён.", caution:"Цены и свободные даты подтверждаются только партнёрами.", close:"Закрыть", open:"Открыть помощника", dismiss:"Скрыть подсказку", links:[["Найти жильё","/stays"],["Туры","/tours"],["Доставка","/delivery"],["Контакты","/contacts"]] },
  ky: { teaser:"Жардам керекпи?", title:"KÖL жардамчысы", welcome:"Салам! Керектүү бөлүмдү табууга жардам берем.", limit:"Азырынча сайттын бөлүмдөрүнө өтүүгө болот. AI маеги туташа элек.", caution:"Бааларды жана бош күндөрдү өнөктөштөр гана ырастайт.", close:"Жабуу", open:"Жардамчыны ачуу", dismiss:"Кеңешти жашыруу", links:[["Турак жай","/stays"],["Турлар","/tours"],["Жеткирүү","/delivery"],["Байланыш","/contacts"]] },
  en: { teaser:"Need a hand?", title:"KÖL assistant", welcome:"Hello! I'll help you find the right section of KÖL.", limit:"Site navigation is ready. AI chat has not been connected yet.", caution:"Only partners can confirm prices and available dates.", close:"Close", open:"Open assistant", dismiss:"Dismiss tip", links:[["Stays","/stays"],["Tours","/tours"],["Delivery","/delivery"],["Contact","/contacts"]] }
} as const;
const excluded = ["/admin","/partner","/client","/courier","/owner","/team","/login","/register","/cart","/checkout","/presentation","/design-system","/account-blocked","/not-authorized"];
export function KolVisitorAssistant() {
  const path=usePathname() || "/";
  const hidden=excluded.some(prefix => path===prefix || path.startsWith(prefix+"/"));
  const [locale,setLocale]=useState<Locale>("ru");
  const [open,setOpen]=useState(false);
  const [teaser,setTeaser]=useState(false);
  const button=useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const read=()=>{ const value=document.documentElement.dataset.kolLocale || localStorage.getItem("kol-locale");setLocale(value==="en"||value==="ky"?value:"ru");};
    read();
    const observer=new MutationObserver(read);
    observer.observe(document.documentElement,{attributes:true,attributeFilter:["data-kol-locale"]});
    return ()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    if(hidden)return;
    try { if(sessionStorage.getItem("kol-assistant-invited")==="1")return; } catch {}
    const id=window.setTimeout(()=>{setTeaser(true);try{sessionStorage.setItem("kol-assistant-invited","1");}catch{}},6000);
    return ()=>window.clearTimeout(id);
  },[hidden]);
  useEffect(()=>{
    if(!open)return;
    const escape=(e:KeyboardEvent)=>{if(e.key==="Escape"){setOpen(false);button.current?.focus();}};
    window.addEventListener("keydown",escape);
    return ()=>window.removeEventListener("keydown",escape);
  },[open]);
  if(hidden)return null;
  const t=wording[locale];
  return <div translate="no" data-i18n-ignore="true" className="pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-3 z-[110] sm:bottom-20 sm:right-5">
    {open&&<section role="region" aria-label={t.title} className="pointer-events-auto mb-3 flex h-[min(70dvh,31rem)] w-[min(calc(100vw-1.5rem),23rem)] flex-col overflow-hidden rounded-3xl border border-primary/20 bg-white shadow-[0_25px_65px_rgba(11,62,65,.23)]">
      <header className="flex items-center justify-between bg-linear-to-r from-primary to-secondary px-5 py-4 text-white">
        <div><p className="text-xs tracking-widest text-white/80">KÖL · ISSYK-KUL</p><h2 className="text-lg font-bold">{t.title}</h2></div>
        <button type="button" aria-label={t.close} onClick={()=>{setOpen(false);button.current?.focus();}} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-2xl hover:bg-white/25">×</button>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto bg-linear-to-b from-[#edf9f8] to-white p-4">
        <p className="max-w-[90%] rounded-2xl rounded-tl-sm bg-white p-4 text-sm leading-6 shadow-sm">{t.welcome}</p>
        <nav className="grid grid-cols-2 gap-2" aria-label={t.title}>{t.links.map(([label,href])=><Link key={href} href={href} onClick={()=>setOpen(false)} className="flex min-h-16 items-center justify-center rounded-2xl border border-primary/15 bg-white px-3 text-center text-sm font-semibold text-secondary shadow-sm transition hover:border-primary hover:bg-lake-light">{label}</Link>)}</nav>
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">{t.caution}</p>
      </div>
      <footer className="border-t border-border px-4 py-3 text-xs leading-5 text-muted">{t.limit}</footer>
    </section>}
    <div className="pointer-events-auto flex items-center justify-end gap-2">
      {teaser&&!open&&<div className="flex items-center gap-1 rounded-full border border-primary/15 bg-white px-2 py-1 shadow-lg">
        <button type="button" onClick={()=>{setOpen(true);setTeaser(false);}} className="min-h-10 px-2 text-xs font-semibold text-secondary sm:text-sm">{t.teaser}</button>
        <button type="button" onClick={()=>setTeaser(false)} aria-label={t.dismiss} className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-muted hover:bg-lake-light">×</button>
      </div>}
      <button ref={button} type="button" aria-label={open?t.close:t.open} aria-expanded={open} onClick={()=>{setOpen(!open);setTeaser(false);}} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/50 bg-primary text-white shadow-[0_10px_30px_rgba(15,143,140,.35)] transition hover:-translate-y-1 hover:bg-secondary">
        {open?<span className="text-3xl">×</span>:<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-7 w-7"><path d="M4 5.5A4.5 4.5 0 0 1 8.5 1h7A4.5 4.5 0 0 1 20 5.5v9a4.5 4.5 0 0 1-4.5 4.5H9L4 22v-5A4.5 4.5 0 0 1 2 13V7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M8 10h8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1 3"/></svg>}
      </button>
    </div>
  </div>;
}

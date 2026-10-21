"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { KolIcon } from "@/components/ui/KolIcon";
type Topic = "stays" | "tours" | "delivery" | "transfer";
const choices: { id: Topic; title: string; path: string; hint: string }[] = [
  { id: "stays", title: "Найти проживание", path: "/stays", hint: "Выберите даты, число гостей и место в каталоге." },
  { id: "tours", title: "Выбрать тур", path: "/tours", hint: "Посмотрите маршруты и уточните сезонность предложения." },
  { id: "delivery", title: "Заказать доставку", path: "/delivery", hint: "Выберите еду или товары и проверьте условия заказа." },
  { id: "transfer", title: "Подобрать трансфер", path: "/transfer", hint: "Уточните маршрут и доступность услуги." }
];
export function KolConcierge() {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [details, setDetails] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) closeRef.current?.focus();
    function onEscape(event: KeyboardEvent) { if (event.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [open]);
  const selected = choices.find(choice => choice.id === topic);
  return (
    <aside className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-50 sm:bottom-6 sm:right-6" aria-label="Помощник KÖL">
      {open && <div className="kol-dialog-enter mb-3 flex max-h-[min(580px,75dvh)] w-[min(365px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" role="dialog" aria-label="Консьерж KÖL" aria-modal="false">
        <header className="flex items-center justify-between bg-slate-900 px-5 py-4 text-white">
          <div><p className="text-base font-semibold">KÖL · Консьерж</p><p className="text-xs text-slate-300">Навигационный помощник · демонстрация</p></div>
          <button ref={closeRef} type="button" onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-lg text-xl hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white" aria-label="Закрыть консьержа">×</button>
        </header>
        <div className="overflow-y-auto p-5">
          <p className="text-sm leading-relaxed text-slate-700">Здравствуйте! Подскажу, куда перейти для поиска жилья, впечатлений, доставки или трансфера.</p>
          <p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">ИИ и данные о наличии пока не подключены. Помощник не оформляет и не подтверждает заявки.</p>
          <div className="mt-4 grid gap-2" aria-label="Быстрые вопросы">
            {choices.map(choice => <button key={choice.id} type="button" aria-pressed={topic===choice.id} onClick={() => setTopic(choice.id)} className={`min-h-11 rounded-lg border px-4 py-2 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-teal-700 ${topic===choice.id ? "border-teal-700 bg-teal-50 text-teal-900" : "border-slate-200 text-slate-800 hover:bg-slate-50"}`}>{choice.title}</button>)}
          </div>
          {selected && <div aria-live="polite" className="mt-4 border-t border-slate-200 pt-4">
            <p className="text-sm text-slate-700">{selected.hint}</p>
            <label htmlFor="kol-concierge-details" className="mt-3 block text-sm font-semibold text-slate-800">Ваши пожелания (не отправляются)</label>
            <textarea id="kol-concierge-details" value={details} onChange={e => setDetails(e.target.value)} rows={2} placeholder="Например: 2 взрослых, Каракол, январь" className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-teal-700" />
            <p className="mt-1 text-xs text-slate-500">В демонстрации введённые сведения не используются для подбора.</p>
            <Link onClick={() => setOpen(false)} href={selected.path} className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-teal-800 px-4 text-sm font-semibold text-white hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">Открыть раздел →</Link>
          </div>}
        </div>
      </div>}
      <button type="button" aria-expanded={open} aria-label={open ? "Свернуть консьержа KÖL" : "Открыть консьержа KÖL"} onClick={() => setOpen(v=>!v)} className="kol-floating-control ml-auto flex min-h-12 items-center gap-2 rounded-full bg-teal-800 px-5 py-3 font-semibold text-white shadow-lg hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
        <KolIcon name="concierge" className="h-5 w-5" /><span>KÖL Консьерж</span>
      </button>
    </aside>
  );
}

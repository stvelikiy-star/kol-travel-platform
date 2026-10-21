"use client";

import { useState } from "react";

type Season = "winter" | "spring" | "summer" | "autumn";
const names: Record<Season, string> = { winter: "Зима", spring: "Весна", summer: "Лето", autumn: "Осень" };
const scenes: Record<Season, { desktop: string; mobile: string; text: string }> = {
  winter: { desktop: "/media/kol/kol-tours.jpg", mobile: "/media/kol/kol-tours.jpg", text: "Зимние маршруты, горы и тёплый отдых" },
  spring: { desktop: "/media/kol/seasonal/spring-v2-desktop.jpg", mobile: "/media/kol/seasonal/spring-v2-mobile.jpg", text: "Весенняя природа и спокойные поездки" },
  summer: { desktop: "/media/kol/seasonal/summer-v2-desktop.jpg", mobile: "/media/kol/seasonal/summer-v2-mobile.jpg", text: "Озеро, пляжи и семейные впечатления" },
  autumn: { desktop: "/media/kol/seasonal/autumn-v2-desktop.jpg", mobile: "/media/kol/seasonal/autumn-v2-mobile.jpg", text: "Золотые ущелья и неспешные путешествия" }
};
const order: Season[] = ["winter", "spring", "summer", "autumn"];

export function SeasonalShowcase({ initialSeason }: { initialSeason: Season }) {
  const [season, setSeason] = useState<Season>(initialSeason);
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8" aria-labelledby="kol-season-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-widest text-teal-700">Планируйте по времени года</p>
          <h2 id="kol-season-title" className="mt-2 text-2xl font-bold sm:text-4xl">У каждого сезона свой Иссык-Куль</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Сезон выбран по текущей дате. Вы можете изменить его вручную. Идеи не подтверждают наличие услуг.</p>
        </div>
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1" role="group" aria-label="Выбрать сезон">
          {order.map(key => <button key={key} type="button" aria-pressed={season === key} onClick={() => setSeason(key)} className={`min-h-11 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${season === key ? "bg-teal-800 text-white" : "text-slate-800 hover:bg-slate-100"}`}>{names[key]}</button>)}
        </div>
      </div>
      <div className="relative mt-6 h-72 overflow-hidden rounded-2xl bg-slate-900 sm:h-96">
        {order.map(key => <picture key={key} aria-hidden="true" className={`absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none ${season === key ? "opacity-100" : "opacity-0"}`}>
          <source media="(max-width: 639px)" srcSet={scenes[key].mobile} />
          <img src={scenes[key].desktop} alt="" loading="lazy" className="h-full w-full object-cover" />
        </picture>)}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
        <div aria-live="polite" className="absolute bottom-0 left-0 max-w-2xl p-6 text-white sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-widest">{names[season]}</p>
          <p className="mt-2 text-2xl font-semibold sm:text-4xl">{scenes[season].text}</p>
          <p className="mt-2 text-sm text-white/85">Подборка для вдохновения — доступность и условия уточняйте в каталоге.</p>
        </div>
      </div>
    </section>
  );
}

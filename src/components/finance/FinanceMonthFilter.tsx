import type {FinancePeriod} from "@/lib/finance/analytics";
export function FinanceMonthFilter({period}:{period:FinancePeriod}){
 return <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-background p-4">
  <label className="grid gap-2 text-sm font-medium">Отчётный месяц
   <input type="month" name="month" required min="2000-01" max="2100-12" defaultValue={period.from.slice(0,7)} className="rounded-lg border border-border bg-surface p-3"/>
  </label>
  <button type="submit" className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white">Показать отчёт</button>
  <p className="text-sm text-muted">{period.from} — {period.toExclusive}</p>
 </form>;
}

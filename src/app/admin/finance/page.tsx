import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/roles";
import { isSupabaseMode } from "@/lib/data/data-source";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { postApprovedVerifiedRecognition } from "@/lib/finance/journal";
import type { FinancePeriod } from "@/lib/finance/analytics";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { readFinanceAdminSettlementPreview } from "@/lib/finance/settlement-preview";
import { readFinanceAdminJournalReport } from "@/lib/finance/journal";
import { currentBishkekFinanceMonth } from "@/lib/finance/report-period";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

const blockedFinanceAreas = [
  "Валовый оборот и выручка платформы",
  "Комиссия KÖL и договорные ставки",
  "Выплаты партнёрам и курьерам",
  "Возвраты, споры и корректировки",
  "Бухгалтерский учёт и экспорт"
];

const activationRequirements = [
  "Подтверждённый платёжный и финансовый источник истины",
  "Серверная проверка прав для финансовых операций",
  "Зафиксированные договорные комиссии и правила выплат",
  "Защита от повторного выполнения платежей, возвратов и выплат",
  "Журнал изменений и ручное подтверждение финансовых действий"
];

type RecognitionCandidate = { id: string; kind: "order" | "booking"; total: number };
type CostSummary = { currency: string; recognized_expense_activity: number };

async function readFinanceWorkspace(period: FinancePeriod, canPost: boolean) {
  if (!isSupabaseMode()) return { candidates: null, costs: null };
  try {
    const db = createSupabaseServiceRoleClient();
    const [costReport, orders, bookings] = await Promise.all([
      db.rpc("kol_finance_cost_report_v1", {
        p_from: period.from, p_to: period.toExclusive, p_business_id: null
      }),
      canPost ? db.from("orders").select("id,total").eq("status","completed").eq("payment_status","paid").order("created_at",{ascending:false}).limit(100) : null,
      canPost ? db.from("bookings").select("id,total").eq("status","completed").eq("payment_status","paid").order("created_at",{ascending:false}).limit(100) : null
    ]);
    const raw = costReport.data;
    let costs: CostSummary[] | null = null;
    if (!costReport.error && raw && raw.kind === "owner_attested_expense_activity" &&
        raw.business_id === null && raw.period_from === period.from && raw.period_to_exclusive === period.toExclusive &&
        Array.isArray(raw.by_currency) && raw.by_currency.every((row: CostSummary) =>
          typeof row.currency === "string" && /^[A-Z]{3}$/.test(row.currency) &&
          Number.isFinite(row.recognized_expense_activity))) {
      costs = raw.by_currency as CostSummary[];
    }
    let candidates: RecognitionCandidate[] | null = null;
    if (canPost && orders && bookings && !orders.error && !bookings.error) {
      const items: RecognitionCandidate[] = [
        ...(orders.data ?? []).map(x => ({id:x.id,kind:"order" as const,total:x.total})),
        ...(bookings.data ?? []).map(x => ({id:x.id,kind:"booking" as const,total:x.total}))
      ];
      if (!items.length) candidates = [];
      else {
        const posted = await db.from("kol_finance_journals_v1").select("subject_type,subject_id")
          .eq("journal_kind","recognition").in("subject_id",items.map(x=>x.id));
        if (!posted.error) {
          const keys = new Set((posted.data ?? []).map(x=>x.subject_type+":"+x.subject_id));
          candidates = items.filter(x=>!keys.has(x.kind+":"+x.id));
        }
      }
    }
    return { candidates, costs };
  } catch { return { candidates: null, costs: null }; }
}

async function recognize(form: FormData): Promise<never> {
  "use server";
  const subject = String(form.get("subject") ?? "");
  const [subjectType, subjectId, ...extra] = subject.split(":");
  if (extra.length || (subjectType !== "order" && subjectType !== "booking") || !subjectId) {
    redirect("/admin/finance?recognition=error");
  }
  const result = await postApprovedVerifiedRecognition({
    subjectType, subjectId, idempotencyKey: "recognition:" + subjectType + ":" + subjectId,
    approvalReference: String(form.get("approval_reference") ?? "")
  });
  if (result.ok) {
    revalidatePath("/admin/finance");
    revalidatePath("/partner/finance");
    revalidatePath("/owner/analytics");
  }
  redirect("/admin/finance?recognition=" + (result.ok ? "saved" : "error"));
}

export default async function AdminFinancePage({searchParams}: {searchParams: Promise<{recognition?: string}>}) {
  const actor = await requireRole(["super_admin","finance_admin"]);
  if (!actor.ok) redirect("/not-authorized");
  const canPost = actor.data.role === "super_admin";
  const params = await searchParams;
  const period=currentBishkekFinanceMonth();
  const [preview,journal,workspace]=await Promise.all([
    readFinanceAdminSettlementPreview(period),
    readFinanceAdminJournalReport(period),
    readFinanceWorkspace(period,canPost)
  ]);
  const currencies = journal.ok && workspace.costs !== null
    ? [...new Set([...journal.data.by_currency.map(x=>x.currency),...workspace.costs.map(x=>x.currency)])].sort()
    : [];
  return (
    <AdminLayout status="attention">
      <Card className="overflow-hidden">
        <div className="bg-linear-to-br from-slate-900 via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">KÖL · Финансовый контроль</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Финансы платформы</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            KÖL показывает финансовые показатели только тогда, когда они подтверждены платёжным и бухгалтерским контуром. Неподтверждённые комиссии, выплаты и возвраты не рассчитываются интерфейсом самостоятельно.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium leading-6 text-foreground">
          Рабочий финансовый источник истины ещё не подключён для признания выручки, прибыли и реальных выплат. Ниже — отдельная проверяемая предварительная сводка из платёжных событий и договорных условий, если серверный источник доступен.
        </CardContent>
      </Card>


      <Card className="border-primary/25">
        <CardHeader>
          <CardTitle>Финансовый результат по учтённым операциям</CardTitle>
          <CardDescription>Текущий месяц · отдельно по каждой валюте</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {journal.ok && workspace.costs !== null ? (
            currencies.length ? currencies.map(currency=>{
              const revenue=journal.data.by_currency.find(x=>x.currency===currency)?.recognized_platform_fee ?? 0;
              const cost=workspace.costs?.find(x=>x.currency===currency)?.recognized_expense_activity ?? 0;
              const revenueCents=Math.round(revenue*100), costCents=Math.round(cost*100);
              const valid=Number.isSafeInteger(revenueCents)&&Number.isSafeInteger(costCents)&&Number.isSafeInteger(revenueCents-costCents);
              const format=(n:number)=>new Intl.NumberFormat("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
              return <div key={currency} className="grid gap-3 rounded-lg border border-border bg-background p-4 sm:grid-cols-3">
                <div><p className="text-muted">Признанная комиссия</p><strong>{format(revenue)} {currency}</strong></div>
                <div><p className="text-muted">Начисленные расходы</p><strong>{format(cost)} {currency}</strong></div>
                <div><p className="text-muted">Результат по проведённым записям</p><strong>{valid?format((revenueCents-costCents)/100):"—"} {currency}</strong></div>
              </div>;
            }) : <p className="text-muted">За период нет признанных доходов и начисленных расходов.</p>
          ) : <p className="text-muted">Финансовая сводка недоступна.</p>}
          <p className="text-muted">Разница признанных комиссий и начисленных расходов не является чистой прибылью: налоги, полнота затрат и банковские расчёты учитываются отдельно.</p>
          <div className="flex flex-wrap gap-3">
            {canPost && <Link href="/admin/finance/costs" className="rounded-lg border border-border px-4 py-3 font-semibold text-primary">Расходы и корректировки</Link>}
            <Link href="/admin/finance/requests" className="rounded-lg border border-border px-4 py-3 font-semibold text-primary">Возвраты и выплаты</Link>
          </div>
        </CardContent>
      </Card>
      {canPost && <Card className="border-success/30">
        <CardHeader>
          <CardTitle>Признать выручку и комиссию</CardTitle>
          <CardDescription>Собственник утверждает проводку по завершённому заказу или бронированию.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {params.recognition === "saved" && <p role="status" className="rounded-lg border border-success/30 p-3">Проводка сохранена в журнале.</p>}
          {params.recognition === "error" && <p role="alert" className="rounded-lg border border-warning/40 bg-warning/10 p-3">Проводка отклонена. Требуется подтверждённое платёжное событие, совпадающая сумма, действующие договорные условия и отсутствие возврата. Повторная проводка не создаётся.</p>}
          {workspace.candidates === null ? <p className="text-muted">Список операций недоступен.</p> : workspace.candidates.length === 0 ? <p className="text-muted">Нет непризнанных завершённых операций среди последних 100 оплаченных заказов и 100 бронирований.</p> : (
            <form action={recognize} className="grid gap-3">
              <label className="grid gap-2">Операция
                <select name="subject" required defaultValue="" className="w-full rounded-lg border border-border bg-surface p-3">
                  <option value="" disabled>Выберите заказ или бронь</option>
                  {workspace.candidates.map(x=><option key={x.kind+":"+x.id} value={x.kind+":"+x.id}>{x.kind==="order"?"Заказ":"Бронь"} · {x.total} · {x.id}</option>)}
                </select>
              </label>
              <label className="grid gap-2">Основание утверждения
                <input name="approval_reference" required minLength={8} maxLength={200} placeholder="Номер документа или основание утверждения" className="w-full rounded-lg border border-border bg-surface p-3"/>
              </label>
              <p className="text-muted">Статус «оплачено» сам по себе недостаточен. Сервер проверяет платёжное событие, договор и сумму. Деньги не переводятся.</p>
              <div><button type="submit" className="rounded-lg bg-primary px-4 py-3 font-semibold text-white">Утвердить проводку</button></div>
            </form>
          )}
        </CardContent>
      </Card>}

      <Card className="border-primary/25">
        <CardHeader>
          <CardTitle>Проверка расчётов · {period.from} — {period.toExclusive} (не включая дату окончания)</CardTitle>
          <CardDescription>
            Данные получены из рабочей базы, без вымышленных сумм. Предварительная комиссия не считается фактической выручкой KÖL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {preview.ok ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-border bg-background p-4"><p className="text-xs text-muted">Заказы и брони</p><p className="text-2xl font-semibold">{preview.data.counts.subjects}</p></div>
                <div className="rounded-lg border border-border bg-background p-4"><p className="text-xs text-muted">Платежи с подтверждением провайдера</p><p className="text-2xl font-semibold">{preview.data.counts.verified_paid_rows}</p></div>
                <div className="rounded-lg border border-border bg-background p-4"><p className="text-xs text-muted">Операции, пригодные для предварительного расчёта</p><p className="text-2xl font-semibold">{preview.data.counts.preview_eligible}</p></div>
                <div className="rounded-lg border border-border bg-background p-4"><p className="text-xs text-muted">Платежи без подходящих условий договора</p><p className="text-2xl font-semibold">{preview.data.counts.missing_terms}</p></div>
              </div>
              {preview.data.by_currency.length ? (
                <div className="space-y-2">
                  {preview.data.by_currency.map(item=><div className="rounded-lg border border-border bg-background p-4 text-sm" key={item.currency}>
                    <p className="font-semibold">{item.currency} · предварительно</p>
                    <p>Проверено платежей: {item.eligible_count}; сумма: {item.provider_verified_gross} {item.currency}</p>
                    <p>Расчёт комиссии по договору: {item.provisional_platform_fee} {item.currency}</p>
                    <p>Предварительная доля партнёров при сборе денег платформой: {item.provisional_partner_allocation_if_platform_collects} {item.currency}</p>
                    <p>Предварительная комиссия к получению от партнёров: {item.provisional_platform_receivable_if_partner_collects} {item.currency}</p>
                  </div>)}
                </div>
              ) : <p className="text-sm text-muted">Нет операций с подтверждённой оплатой, завершённой услугой и согласованным договором. Суммы не рассчитываются.</p>}
              <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
                Прибыль, признанная выручка, задолженность и реальные выплаты не подтверждены. Операции не создаются этим экраном.
              </p>
            </>
          ) : (
            <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              Серверный финансовый отчёт недоступен или роль не подтверждена. Ниже нет подстановки демонстрационных сумм.
            </p>
          )}
        </CardContent>
      </Card>


      <Card className="border-success/30">
        <CardHeader>
          <CardTitle>Зарегистрированные финансовые проводки</CardTitle>
          <CardDescription>
            Отчёт по дате признания в журнале, а не по дате заявки. Только подтверждённые проводки с двойной записью.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {journal.ok ? (
            <>
              <div className="rounded-lg border border-border bg-background p-4 text-sm">
                Записей в журнале: <strong>{journal.data.journal_count}</strong>.
                Дата признания: {journal.data.period_from} — {journal.data.period_to_exclusive} (конец не включён).
              </div>
              {journal.data.by_currency.length ? journal.data.by_currency.map(row=>(
                <div className="rounded-lg border border-border bg-background p-4 text-sm" key={row.currency}>
                  <p className="font-semibold">Признанная комиссия KÖL · {row.currency}</p>
                  <p>{row.recognized_platform_fee} {row.currency}, проводок: {row.recognitions}</p>
                  <p>Учётное обязательство перед партнёрами до выплат: {row.posted_partner_payable_before_payouts} {row.currency}</p>
                  <p>Учётное требование к партнёрам до оплат: {row.posted_partner_receivable_before_collections} {row.currency}</p>
                </div>
              )) : <p className="text-sm text-muted">Проводок за период нет. Это не означает, что все заявки оплачены или что прибыль равна нулю.</p>}
              <p className="text-sm text-muted">
                Денежный расчёт с банком, фактические выплаты и чистая прибыль — Не подтверждено.
              </p>
            </>
          ) : <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
            Журнал признанных операций недоступен. Показатели не заменяются демо-данными.
          </p>}
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {blockedFinanceAreas.map((label) => (
          <Card key={label}>
            <CardContent className="space-y-3 p-5">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <Badge variant="muted">Не подтверждено</Badge>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Почему суммы пока скрыты</CardTitle>
            <CardDescription>Заказ или бронь ещё не равны подтверждённой финансовой операции.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted">
            <p>Интерфейс не выводит комиссию из условного процента и не вычисляет выплаты из стоимости заказа.</p>
            <p>Статусы оплаты, возврата и выплаты должны поступать только из проверенного серверного финансового контура.</p>
            <p>Пока он не подключён, отсутствие данных отображается как «Не подтверждено», а не как фиктивная сумма.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Условия включения финансовых операций</CardTitle>
            <CardDescription>Раздел станет рабочим после выполнения всех финансовых и контрольных условий.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {activationRequirements.map((item) => (
              <div className="rounded-md border border-border bg-background p-3 text-sm font-medium text-foreground" key={item}>
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/25 bg-lake-light">
        <CardHeader>
          <CardTitle>Финансовые действия остаются под контролем человека</CardTitle>
          <CardDescription>
            Интерфейс и AI не создают выплаты, возвраты, споры, комиссии или бухгалтерские документы самостоятельно. Такие действия выполняются только через разрешённый финансовый процесс.
          </CardDescription>
        </CardHeader>
      </Card>
    </AdminLayout>
  );
}

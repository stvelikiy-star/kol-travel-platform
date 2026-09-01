import { randomUUID } from "node:crypto";
import { partnerStopFormAction } from "@/app/actions/partner/partnerStop";
import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { requirePartner } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type StopScope = "new_orders" | "new_bookings" | "business";
type StopRow = { scope_type: string; is_paused: boolean; reason: string | null; resume_at: string | null };
type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };
function first(value?: string | string[]) { return Array.isArray(value) ? value[0] : value; }

export default async function PartnerStopPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const profile = await requirePartner();
  const canManage = profile.ok && ["partner_owner", "partner_manager"].includes(profile.data.role);
  const supabase = profile.ok ? await createSupabaseServerClient() : null;
  const response = supabase && profile.ok && profile.data.partnerId
    ? await supabase.from("partner_stop_statuses").select("scope_type,is_paused,reason,resume_at").eq("business_id", profile.data.partnerId)
    : { data: null, error: new Error("unavailable") };
  const rows = (response.data ?? []) as StopRow[];
  const sourceReady = Boolean(supabase && !response.error);
  const byScope = new Map(rows.map((row) => [row.scope_type, row]));
  const ordersPaused = isEffectivePause(byScope.get("new_orders"));
  const bookingsPaused = isEffectivePause(byScope.get("new_bookings"));
  const state = first(params?.partnerStop);
  const action = first(params?.action);
  const scope = first(params?.scope);
  const code = first(params?.code);

  return (
    <PartnerLayout>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Operational stop controls</Badge>
          <h2 className="mt-4 text-2xl font-semibold sm:text-3xl">Стоп-кнопка партнёра</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">Приостанавливает только будущий спрос. Принятые заказы, подтверждённые брони, оплаты и остатки не изменяются.</p>
        </div>
      </Card>
      {state ? <Card className={state === "success" ? "border-success/40 bg-success/10" : "border-danger/40 bg-danger/10"}><CardContent className="p-4 text-sm font-medium" role="status">{state === "success" ? `${action === "pause" ? "Пауза включена" : "Приём возобновлён"}: ${scope}.` : `Действие отклонено безопасно${code ? `: ${code}` : "."}`}</CardContent></Card> : null}
      <Card className={sourceReady ? "border-success/40 bg-success/10" : "border-warning/40 bg-warning/10"}><CardContent className="p-4 text-sm font-medium">{sourceReady ? "Статусы получены из Supabase через partner-scoped RLS. Каждое изменение проходит atomic RPC и audit log." : "Supabase stop backend недоступен. Все кнопки заблокированы fail-closed."}</CardContent></Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <StopCard title="Новые заказы" scope="new_orders" paused={ordersPaused} row={byScope.get("new_orders")} enabled={sourceReady && canManage} />
        <StopCard title="Новые бронирования" scope="new_bookings" paused={bookingsPaused} row={byScope.get("new_bookings")} enabled={sourceReady && canManage} />
      </div>
      <Card className="border-danger/30 bg-danger/10"><CardHeader><CardTitle>Весь будущий спрос</CardTitle><CardDescription>Одной транзакцией меняет scopes новых заказов и новых бронирований.</CardDescription></CardHeader><CardContent><StopForm scope="business" paused={ordersPaused && bookingsPaused} enabled={sourceReady && canManage} /></CardContent></Card>
    </PartnerLayout>
  );
}

function isEffectivePause(row?: StopRow) { return Boolean(row?.is_paused && (!row.resume_at || new Date(row.resume_at).getTime() > Date.now())); }

function StopCard({ title, scope, paused, row, enabled }: { title: string; scope: "new_orders" | "new_bookings"; paused: boolean; row?: StopRow; enabled: boolean }) {
  return <Card><CardHeader><Badge className="w-fit" variant={paused ? "danger" : "success"}>{paused ? "paused" : "active"}</Badge><CardTitle>{title}</CardTitle><CardDescription>{row?.reason || "Ограничение не установлено."}</CardDescription></CardHeader><CardContent><StopForm scope={scope} paused={paused} enabled={enabled} /></CardContent></Card>;
}

function StopForm({ scope, paused, enabled }: { scope: StopScope; paused: boolean; enabled: boolean }) {
  return <form action={partnerStopFormAction} className="grid gap-3">
    <input name="scope" type="hidden" value={scope} /><input name="action" type="hidden" value={paused ? "resume" : "pause"} /><input name="requestId" type="hidden" value={randomUUID()} />
    <label className="grid gap-2 text-sm font-semibold">Причина<textarea className="min-h-24 rounded-md border border-border bg-background p-3 font-normal" maxLength={500} name="reason" placeholder={paused ? "Причина возобновления (необязательно)" : "Почему нужно временно остановить приём?"} required={!paused} /></label>
    {!paused ? <label className="grid gap-2 text-sm font-semibold">Автовозобновление (необязательно)<input className="min-h-11 rounded-md border border-border bg-background px-3" name="resumeAt" type="datetime-local" /></label> : null}
    <Button disabled={!enabled} type="submit" variant={paused ? "secondary" : "danger"}>{paused ? "Возобновить приём" : "Приостановить будущий спрос"}</Button>
  </form>;
}

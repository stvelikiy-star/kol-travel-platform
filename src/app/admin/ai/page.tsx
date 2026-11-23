import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { requireRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function KolAiControlCenter() {
  const actor = await requireRole(["super_admin","content_manager"]);
  if (!actor.ok) redirect("/not-authorized");
  const base = actor.data.role === "content_manager" ? "/editor/ai" : "/admin/ai";
  const supabase = await createSupabaseServerClient();
  const [materials,channels] = supabase
    ? await Promise.all([
        supabase.from("kol_ai_materials_v1").select("status,kind,locale").limit(1000),
        supabase.from("kol_ai_channels_v1").select("channel,enabled,auto_reply")
      ])
    : [{data:null,error:{message:"offline"}},{data:null,error:{message:"offline"}}];
  const available = Boolean(supabase && !materials.error && !channels.error);
  const entries = available ? materials.data ?? [] : [];
  const integration = available ? channels.data ?? [] : [];
  return <AdminLayout status={available ? "stable" : "attention"}>
    <section className="rounded-2xl bg-linear-to-br from-slate-950 via-primary to-secondary p-6 text-white shadow-lg sm:p-8">
      <Badge className="border-white/30 bg-white text-primary">KÖL AI · Управление</Badge>
      <h2 className="mt-4 text-3xl font-semibold">Центр управления ИИ-помощником</h2>
      <p className="mt-3 max-w-3xl leading-7 text-white/85">
        Готовим знания, точные скрипты ответов и правила передачи обращения сотруднику.
        Реальная модель, WhatsApp и Telegram пока не подключены. Изменение настроек здесь
        не отправляет сообщения и не запускает автоматических действий.
      </p>
    </section>
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        ["Материалов", available ? entries.length : "—"],
        ["Опубликованных", available ? entries.filter(x => x.status === "published").length : "—"],
        ["Активных ИИ-каналов", available ? integration.filter(x => x.enabled && x.auto_reply).length : "0"]
      ].map(([label,value])=><div className="kol-adm-kpi kol-adm-kpi--info" key={label}>
        <p className="kol-adm-kpi-label">{label}</p>
        <strong className="kol-adm-kpi-value">{value}</strong>
      </div>)}
    </div>
    {!available && <Card className="border-warning/40 bg-warning/10">
      <CardContent className="p-5 text-sm leading-6">
        Хранилище знаний ещё не развёрнуто в подключённой базе либо права не подтверждены.
        Создание и публикация материалов недоступны. Демо-записи не подставляются.
      </CardContent>
    </Card>}
    <div className="grid gap-4 md:grid-cols-2">
      <Link href={base+"/knowledge"} className="block rounded-xl border border-border bg-surface p-6 shadow-card transition hover:border-primary">
        <h3 className="text-xl font-semibold text-foreground">База знаний и скрипты</h3>
        <p className="mt-2 text-sm leading-6 text-muted">
          FAQ, инструкции по жилью, турам, доставке, подключению партнёров,
          ответы на частые вопросы и правила передачи оператору на RU/KG/EN.
        </p>
        <span className="mt-4 inline-block font-semibold text-primary">Открыть редактор →</span>
      </Link>
      <Link href={base+"/channels"} className="block rounded-xl border border-border bg-surface p-6 shadow-card transition hover:border-primary">
        <h3 className="text-xl font-semibold text-foreground">Каналы и передача оператору</h3>
        <p className="mt-2 text-sm leading-6 text-muted">
          Сайт, WhatsApp и Telegram. Подготовка маршрутов поддержки, инструкций
          и ответственных. Ключи подключения здесь не хранятся.
        </p>
        <span className="mt-4 inline-block font-semibold text-primary">Открыть настройки →</span>
      </Link>
    </div>
    <Card>
      <CardHeader><CardTitle>Источник ответов KÖL AI</CardTitle></CardHeader>
      <CardContent className="grid gap-3 text-sm leading-6 md:grid-cols-3">
        <div className="rounded-xl border border-border p-4"><b>1. Подтверждённые данные</b>
          <p className="mt-1 text-muted">Цены, свободные даты, каталог, заказы и статусы — только из защищённых серверных источников КЁЛь.</p>
        </div>
        <div className="rounded-xl border border-border p-4"><b>2. Опубликованные инструкции</b>
          <p className="mt-1 text-muted">Черновики не используются в ответах. Внутренние инструкции нельзя раскрывать клиентам.</p>
        </div>
        <div className="rounded-xl border border-border p-4"><b>3. Человек при споре</b>
          <p className="mt-1 text-muted">Возвраты, оплата, конфликт брони, жалоба или неизвестный ответ — передача сотруднику без выдуманных обещаний.</p>
        </div>
      </CardContent>
    </Card>
  </AdminLayout>;
}

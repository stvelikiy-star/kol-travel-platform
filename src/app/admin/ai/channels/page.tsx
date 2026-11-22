import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { saveAiChannelSettings } from "@/app/actions/admin/aiKnowledge";
import { requireRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic="force-dynamic";
type Channel={channel:string;provider:string;route_hint:string;admin_note:string;enabled:boolean;auto_reply:boolean;updated_at:string};

export default async function AiChannelsPage({searchParams}:{searchParams:Promise<{result?:string}>}) {
  const actor=await requireRole(["super_admin","content_manager"]);
  if(!actor.ok)redirect("/not-authorized");
  const base=actor.data.role==="content_manager"?"/editor/ai":"/admin/ai";
  const result=await searchParams;
  const supabase=await createSupabaseServerClient();
  const response=supabase?await supabase.from("kol_ai_channels_v1")
    .select("channel,provider,route_hint,admin_note,enabled,auto_reply,updated_at")
    .order("channel"):null;
  const available=Boolean(response&&!response.error);
  const channels=(available?response?.data??[]:[]) as Channel[];
  async function save(form:FormData) {
    "use server";
    const reply=await saveAiChannelSettings(form);
    const role=await requireRole(["super_admin","content_manager"]);
    const prefix=role.ok&&role.data.role==="content_manager"?"/editor/ai":"/admin/ai";
    redirect(prefix+"/channels?result="+reply.code);
  }
  return <AdminLayout status={available?"stable":"attention"}>
    <Link href={base} className="text-sm font-semibold text-primary">← Центр KÖL AI</Link>
    <Card><CardHeader><CardTitle>Каналы, эскалация и параметры подключения</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm leading-6">
        <p>Сайт, WhatsApp и Telegram будут работать с единой опубликованной базой знаний.
          Пока все AI-каналы выключены. Настройки здесь подготавливают маршруты передачи сотруднику,
          но не подключают ботов и не отправляют сообщения.</p>
        <p className="rounded-lg border border-warning/30 bg-warning/10 p-3">
          API-ключи OpenAI, GREEN-API и Telegram никогда не вводятся в эту форму и не хранятся в базе знаний.
          Позднее они настраиваются как серверные секреты в отдельном окружении.
        </p>
        {result.result&&<p role="status" className="rounded-lg bg-lake-light p-3">
          {result.result==="channel_saved"?"Настройки маршрута сохранены":"Сохранение отклонено: "+result.result}
        </p>}
        {!available&&<p className="rounded-lg border border-danger/30 p-4">Каналы пока недоступны в подключённой базе. Никакие подключения не включены.</p>}
      </CardContent>
    </Card>
    <div className="grid gap-4 xl:grid-cols-3">
      {channels.map(c=><Card key={c.channel}>
        <CardHeader><div className="flex flex-wrap items-center gap-2">
          <CardTitle>{c.channel==="web"?"Сайт КЁЛь":c.channel==="whatsapp"?"WhatsApp":"Telegram"}</CardTitle>
          <Badge variant="warning">ИИ выключен</Badge>
        </div></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted">{c.provider}</p>
          <p>Автоответ: <b>выключен</b>. Интеграция: <b>не подключена</b>.</p>
          <form action={save} className="grid gap-3">
            <input type="hidden" name="channel" value={c.channel}/>
            <label className="grid gap-1">Куда направлять за помощью
              <input className="rounded-lg border border-border bg-background p-3" required
                name="route_hint" maxLength={139} pattern="/[a-z0-9/_-]*" defaultValue={c.route_hint}/>
            </label>
            <label className="grid gap-1">Инструкции для сотрудников (без секретов)
              <textarea name="admin_note" maxLength={1000} rows={5} defaultValue={c.admin_note}
                className="rounded-lg border border-border bg-background p-3"/>
            </label>
            <button type="submit" className="rounded-lg bg-primary px-4 py-3 font-semibold text-white">Сохранить настройки</button>
          </form>
        </CardContent>
      </Card>)}
    </div>
    <Card><CardHeader><CardTitle>Когда ИИ обязан передать обращение человеку</CardTitle></CardHeader>
      <CardContent className="grid gap-3 text-sm leading-6 sm:grid-cols-2">
        {[
          ["Оплата и возвраты","Не подтверждать поступления, выплаты или возвраты без данных платёжного провайдера."],
          ["Спор с партнёром","Не менять бронирование и условия самостоятельно; направлять сотруднику поддержки."],
          ["Нет подтверждённых данных","Не придумывать цену, дату, место, контакт или статус заказа."],
          ["Персональные данные","Без авторизации нельзя раскрывать чужие заявки, маршруты и телефоны."]
        ].map(([title,desc])=><div className="rounded-xl border border-border p-4" key={title}>
          <b>{title}</b><p className="mt-1 text-muted">{desc}</p>
        </div>)}
      </CardContent>
    </Card>
  </AdminLayout>;
}

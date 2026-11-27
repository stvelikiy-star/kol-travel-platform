import { randomUUID } from "node:crypto";
import Link from "next/link";
import { adminRoomLifecycleFormAction } from "@/app/actions/admin/adminRoomLifecycle";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent } from "@/components/ui/Card";
import { requireSuperAdmin } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { displayBusinessStatus } from "@/lib/i18n/status-labels";

export const dynamic = "force-dynamic";

type Room = {
  id: string;
  title: string;
  status: string;
  capacity: number;
  price_per_night: number;
  stay_id: string;
  business_id: string;
  stays: { title: string; status: string } | { title: string; status: string }[] | null;
};
const demoStay = "41000000-0000-0000-0000-000000000001";
function canRun(status: string, action: string, price: number, capacity: number, title: string) {
  const validRoom = Number.isFinite(price) && price > 0 && Number.isInteger(capacity) && capacity > 0 && title.trim().length > 0;
  if (action === "approve") return status === "under_review" && validRoom;
  if (action === "reject") return status === "under_review";
  if (action === "publish") return status === "approved" && validRoom;
  return action === "unpublish" && status === "active";
}
export default async function AdminRoomsPage({
  searchParams
}: { searchParams?: Promise<{ roomAction?: string; action?: string; code?: string }> }) {
  const actor = await requireSuperAdmin();
  if (!actor.ok) {
    return <AdminLayout status="attention"><p role="alert">Доступ только для главного администратора.</p></AdminLayout>;
  }
  const db = await createSupabaseServerClient();
  if (!db) {
    return <AdminLayout status="attention"><p role="alert">База данных временно недоступна.</p></AdminLayout>;
  }
  const { data, error } = await db.from("rooms")
    .select("id,title,status,capacity,price_per_night,stay_id,business_id,stays(title,status)")
    .neq("stay_id", demoStay)
    .order("title")
    .limit(100);
  const rooms = (data ?? []) as Room[];
  const params = await searchParams;
  return (
    <AdminLayout status="attention">
      <div className="space-y-5">
        <header className="space-y-2">
          <Link href="/admin/catalog/stays" className="text-sm font-semibold text-primary hover:underline">← Каталог жилья</Link>
          <h2 className="text-2xl font-semibold">Номера — отдельная модерация</h2>
          <p className="text-sm text-muted">Одобрение и публикация — отдельные решения главного администратора. Партнёр должен подтвердить цену и описание номера. Без подтверждённых свободных мест бронирование невозможно.</p>
        </header>
        <Card className="border-warning/50">
          <CardContent className="p-4 text-sm leading-6">
            Каждое решение проверяется сервером и записывается в журнал. Публикация номера не создаёт доступные даты. Массовое одобрение исключено.
          </CardContent>
        </Card>
        {params?.roomAction ? <Card className={params.roomAction === "success" ? "border-success/40" : "border-danger/40"}>
          <CardContent role="status" className="p-4 text-sm">
            {params.roomAction === "success" ? "Сервер подтвердил изменение и аудит." : `Изменение отклонено: ${params.code ?? "unknown"}.`}
          </CardContent>
        </Card> : null}
        {error ? <p role="alert" className="rounded-md border border-danger/40 p-4">Нет безопасного доступа к реестру номеров. Действия отключены.</p> : null}
        {!error && rooms.length === 0 ? <p role="status">Доступные для проверки номера не найдены.</p> : null}
        {!error ? <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Номера", value: rooms.length },
            { label: "На проверке", value: rooms.filter(room => room.status === "under_review").length },
            { label: "Одобрено", value: rooms.filter(room => room.status === "approved").length },
            { label: "Опубликовано", value: rooms.filter(room => room.status === "active").length }
          ].map(metric => <Card key={metric.label}><CardContent className="p-4"><p className="text-sm text-muted">{metric.label}</p><p className="text-2xl font-semibold">{metric.value}</p></CardContent></Card>)}
          <p className="text-xs text-muted sm:col-span-2 lg:col-span-4">Показаны не более 100 номеров.</p>
        </section> : null}
        {!error ? <section className="space-y-4">
          {rooms.map(room => {
            const price = Number(room.price_per_night);
            const stay = Array.isArray(room.stays) ? room.stays[0] : room.stays;
            return <Card key={room.id}>
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h3 className="font-semibold">{room.title}</h3><p className="text-sm text-muted">{stay?.title ?? "Объект не определён"}</p></div>
                  <strong className="rounded-md border px-3 py-1 text-sm">{displayBusinessStatus(room.status)}</strong>
                </div>
                <p className="text-sm">{room.capacity} гостей · {price} KGS/ночь {price <= 0 ? "· Требуется подтверждение цены" : "· Проверьте актуальность тарифа"}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(["approve", "reject", "publish", "unpublish"] as const).map(action => (
                    <form key={action} action={adminRoomLifecycleFormAction} className="space-y-2 rounded-md border p-3">
                      <input type="hidden" name="roomId" value={room.id} />
                      <input type="hidden" name="action" value={action} />
                      <input type="hidden" name="requestId" value={randomUUID()} />
                      <label className="block text-sm font-semibold">Причина решения для аудита
                        <input name="reason" minLength={3} maxLength={500} required placeholder="Подтверждение партнёра"
                          className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3 text-foreground" />
                      </label>
                      <button type="submit" disabled={!canRun(room.status, action, price, room.capacity, room.title)}
                        className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
                        {action === "approve" ? "Одобрить" : action === "reject" ? "Отклонить" : action === "publish" ? "Опубликовать" : "Снять с публикации"}
                      </button>
                    </form>
                  ))}
                </div>
              </CardContent>
            </Card>;
          })}
        </section> : null}
      </div>
    </AdminLayout>
  );
}

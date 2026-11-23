import { randomUUID } from "node:crypto";
import { createCourierDeliveryIssueAction } from "@/app/actions/courier/courierDeliveryIssuesReal";
import { CourierLayout } from "@/components/layout/CourierLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getCourierDeliveriesReadResult } from "@/lib/data/courier-deliveries-read";
import { getCourierDeliveryIssuesReadResult } from "@/lib/data/delivery-issues-read";

export const dynamic = "force-dynamic";

const categories = [
  { value: "partner_pickup", label: "Проблема у партнёра / при выдаче" },
  { value: "client_address", label: "Адрес или доступность клиента" },
  { value: "damaged_order", label: "Комплектация или повреждение" },
  { value: "route_safety", label: "Маршрут, транспорт, безопасность" },
  { value: "payment_admin", label: "Вопрос по оплате — администратору" }
];
const priorityLabels = [
  { value: "low", label: "Низкий" },
  { value: "medium", label: "Обычный" },
  { value: "high", label: "Высокий" },
  { value: "critical", label: "Критический" }
];
const notices: Record<string, string> = {
  created: "Обращение сохранено в PostgreSQL и доступно операционной команде.",
  duplicate_request: "Такое обращение уже отправлялось. Повторная запись не создана.",
  not_authorized: "Нужен действующий вход курьера.",
  supabase_required: "Создание обращений доступно только в рабочем режиме Supabase.",
  invalid_request: "Выберите действующую доставку.",
  invalid_category: "Выберите категорию и приоритет.",
  invalid_description: "Опишите проблему: от 12 до 1000 символов.",
  service_unavailable: "Сервис обращений временно недоступен.",
  delivery_not_assigned: "Доставка не назначена вашему аккаунту.",
  create_failed: "Сервер отклонил создание обращения."
};

type Params = { issue?: string | string[] };

export default async function CourierIssuesPage({ searchParams }: { searchParams?: Promise<Params> }) {
  const params = await searchParams;
  const code = Array.isArray(params?.issue) ? params?.issue[0] : params?.issue;
  const [deliveryResult, issueResult] = await Promise.all([
    getCourierDeliveriesReadResult(),
    getCourierDeliveryIssuesReadResult()
  ]);
  const available = deliveryResult.source === "supabase" &&
    (deliveryResult.ok || deliveryResult.code === "empty_result");
  const assignments = available ? deliveryResult.deliveries : [];
  const canSubmit = assignments.length > 0;

  return (
    <CourierLayout status={canSubmit ? "busy" : "online"}>
      <Card className="overflow-hidden">
        <div className="bg-linear-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">KÖL Courier Support</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Проблемы доставки</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Сообщение направляется по вашей назначенной доставке в операционную очередь.
            Курьер не меняет оплату, возвраты или статус заказа этим обращением.
          </p>
        </div>
      </Card>

      {code ? <Card className={code === "created" ? "border-success/40 bg-success/10" : "border-warning/40 bg-warning/10"}>
        <CardContent className="p-4 text-sm font-medium" role="status">{notices[code] ?? "Запрос обработан сервером."}</CardContent>
      </Card> : null}

      <Card>
        <CardHeader><CardTitle>Сообщить о проблеме</CardTitle><CardDescription>
          Выберите только свою назначенную доставку. Операция сохраняется с вашим ID и временем отправки.
        </CardDescription></CardHeader>
        <CardContent>
          {!available ? <p className="text-sm text-danger">Недоступны подтверждённые назначения курьера. Обращение не создаётся.</p> :
          !canSubmit ? <p className="text-sm text-muted">Сейчас нет активных назначенных доставок.</p> :
          <form action={createCourierDeliveryIssueAction} className="grid max-w-2xl gap-4">
            <input type="hidden" name="requestId" value={randomUUID()} />
            <label className="grid gap-2 text-sm font-semibold">Доставка
              <select name="deliveryId" required className="min-h-11 rounded-md border border-border bg-background px-3 py-2">
                <option value="">Выберите назначенную доставку</option>
                {assignments.map(d => <option key={d.id} value={d.id}>{d.partnerTitle ?? d.businessId} · {d.id.slice(0, 8)} · {d.status}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">Категория
              <select name="category" required className="min-h-11 rounded-md border border-border bg-background px-3 py-2">
                <option value="">Выберите категорию</option>
                {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">Приоритет
              <select name="priority" defaultValue="medium" className="min-h-11 rounded-md border border-border bg-background px-3 py-2">
                {priorityLabels.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">Описание проблемы
              <textarea name="description" minLength={12} maxLength={1000} required rows={4}
                placeholder="Что случилось и какая помощь требуется?" className="w-full rounded-md border border-border bg-background p-3 text-sm" />
            </label>
            <Button type="submit">Отправить обращение</Button>
          </form>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Мои обращения</CardTitle><CardDescription>Данные получены из рабочей базы, а не из демонстрационных записей.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {!issueResult.ok ? <p className="text-sm text-muted">История временно недоступна. Новые обращения сервер проверяет отдельно.</p> :
          issueResult.items.length === 0 ? <p className="text-sm text-muted">Обращений пока нет.</p> :
          issueResult.items.map(issue => <div key={issue.id} className="rounded-md border border-border p-3 text-sm">
            <div className="flex flex-wrap gap-2"><Badge variant={issue.status === "open" ? "warning" : "success"}>{issue.status}</Badge><Badge variant="muted">{issue.priority}</Badge></div>
            <p className="mt-2 font-semibold">{issue.category} · {issue.delivery_id.slice(0, 8)}</p>
            <p className="mt-1 whitespace-pre-wrap text-muted">{issue.description}</p>
            <p className="mt-2 text-xs text-muted">{new Date(issue.created_at).toLocaleString("ru-RU")}</p>
          </div>)}
        </CardContent>
      </Card>
    </CourierLayout>
  );
}

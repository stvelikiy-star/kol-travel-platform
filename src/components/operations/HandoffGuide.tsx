import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

type HandoffGuideProps = { mode: "partner" | "courier" };

const handoffStatuses = ["new_order", "accepted_by_partner", "preparing", "ready_for_pickup", "courier_assigned", "courier_to_partner", "picked_up", "courier_to_client", "delivered", "issue_reported", "admin_required"];
const partnerResponsibility = ["принять или отклонить заказ", "подготовить заказ", "отметить готовность к выдаче", "сохранить заказ упакованным до приезда курьера", "сообщить о проблеме, если курьер не приехал"];
const partnerAfterPickup = ["не отменяет заказ", "не меняет статус доставки", "не меняет статус оплаты", "при проблеме обращается к администратору / поддержке"];
const courierResponsibility = ["принять назначенную доставку", "доехать до партнёра", "забрать заказ", "подтвердить получение", "доехать до клиента", "передать заказ", "сообщить о проблеме при необходимости"];
const courierCannot = ["не меняет статус оплаты", "не меняет состав заказа", "не отменяет заказ", "не меняет статус приготовления у партнёра"];
const delayCases = ["курьер назначен, но не начал движение", "готовый заказ слишком долго ждёт", "партнёр сообщил о задержке курьера", "курьер сообщил о проблеме на точке партнёра", "возникла проблема с адресом или связью с клиентом"];
const aiSafety = ["AI может обнаружить задержку", "AI может рекомендовать переназначение курьера", "AI может уведомить администратора", "AI может подготовить сообщение участникам", "AI не отменяет заказ", "AI не меняет оплату", "high-risk действия требуют человеческого подтверждения"];

export function HandoffGuide({ mode }: HandoffGuideProps) {
  const isPartner = mode === "partner";
  return (
    <Card className="border-primary/30 bg-surface/95 shadow-card">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap gap-2"><Badge variant="info">Передача заказа</Badge><Badge variant="warning">ready_for_pickup → picked_up</Badge><Badge variant="muted">Регламент</Badge></div>
        <div>
          <CardTitle className="text-base">{isPartner ? "Передача заказа курьеру" : "Получение заказа у партнёра"}</CardTitle>
          <CardDescription>{isPartner ? "Зона партнёра заканчивается после подтверждённой передачи заказа курьеру." : "Зона курьера начинается после назначения или принятия доставки и продолжается до подтверждённой передачи клиенту."}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-border bg-background/80 p-3"><p className="mb-3 text-sm font-semibold text-foreground">Техническая цепочка статусов</p><div className="flex flex-wrap gap-2">{handoffStatuses.map((status) => <Badge key={status} variant={status === "ready_for_pickup" ? "warning" : status === "picked_up" ? "success" : status === "admin_required" ? "danger" : "muted"}>{status}</Badge>)}</div></div>
        {isPartner ? <><GuideSection title="Зона ответственности партнёра" items={partnerResponsibility} tone="success" /><GuideSection title="После передачи курьеру" items={partnerAfterPickup} tone="warning" /></> : <><GuideSection title="Зона ответственности курьера" items={courierResponsibility} tone="success" /><GuideSection title="Курьер не отвечает за" items={courierCannot} tone="danger" /></>}
        <GuideSection title={isPartner ? "Если курьер задерживается" : "Проблема на точке партнёра / у клиента"} items={delayCases} tone="warning" />
        <GuideSection title="AI-диспетчер и администратор" items={aiSafety} tone="info" />
        <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm leading-6 text-foreground">Алкогольный модуль отключён и не входит в текущую версию KÖL. Любая будущая активация требует юридического согласования, проверки партнёра и отдельного административного разрешения.</div>
      </CardContent>
    </Card>
  );
}

function GuideSection({ items, title, tone }: { items: string[]; title: string; tone: "success" | "danger" | "warning" | "info" }) {
  const toneLabel = { success: "Можно", danger: "Ограничение", warning: "Внимание", info: "Информация" }[tone];
  return <div className="rounded-md border border-border bg-background/80 p-3"><div className="mb-2 flex items-center justify-between gap-2"><p className="text-sm font-semibold text-foreground">{title}</p><Badge variant={tone}>{toneLabel}</Badge></div><ul className="space-y-1 text-sm leading-5 text-muted">{items.map((item) => <li className="break-words" key={item}>{item}</li>)}</ul></div>;
}

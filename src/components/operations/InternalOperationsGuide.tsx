import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

type InternalOperationsGuideProps = { mode: "partner" | "courier" };

const partnerAttention = ["Что требует внимания", "Новые заказы", "Готово к выдаче", "Ожидает курьера", "Сегодняшние брони", "Стоп-лист"];
const courierAttention = ["Доступные доставки", "Активная доставка", "Следующий шаг", "Маршрут", "Проблема на доставке", "Связь с админом"];
const partnerCan = ["Принять или отклонить новый заказ", "Отметить заказ как готовится", "Отметить готово к выдаче", "Подтвердить или отклонить бронь", "Остановить новые заявки выбранной области"];
const partnerCannot = ["Менять статус оплаты", "Закрывать курьерскую доставку", "Отменять заказ после получения курьером без админа", "Отменять уже принятые заказы или брони стоп-кнопкой", "Включать регулируемые модули без отдельного разрешения"];
const courierCan = ["Принять доступную или назначенную доставку", "Ехать к партнёру", "Отметить получение заказа", "Ехать к клиенту", "Отметить доставку или сообщить проблему"];
const courierCannot = ["Менять статус оплаты", "Менять состав заказа", "Отменять заказ без админа", "Менять статус подготовки партнёра", "Включать регулируемые модули без отдельного разрешения"];
const adminCases = ["Высокий риск или спор", "Отмена принятого заказа или брони", "Проблема оплаты или возврата", "Курьер не вышел на связь", "AI рекомендует high-risk действие"];
const aiLimits = ["AI может рекомендовать", "AI может уведомлять", "AI может предлагать переназначение курьера", "AI может подготовить сообщение", "AI не отменяет заказ", "AI не меняет статус оплаты", "High-risk действия требуют человеческого подтверждения"];

export function InternalOperationsGuide({ mode }: InternalOperationsGuideProps) {
  const isPartner = mode === "partner";
  const attention = isPartner ? partnerAttention : courierAttention;
  const canItems = isPartner ? partnerCan : courierCan;
  const cannotItems = isPartner ? partnerCannot : courierCannot;
  return (
    <Card className="border-primary/25 bg-surface/95 shadow-card">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap items-center gap-2"><Badge variant="info">{isPartner ? "Операции партнёра" : "Операции курьера"}</Badge><Badge variant="warning">Контролируемые действия</Badge></div>
        <div><CardTitle className="text-base">{isPartner ? "Операционная зона партнёра" : "Операционная зона курьера"}</CardTitle><CardDescription>{isPartner ? "Партнёр отвечает за принятие, подготовку и передачу заказа в выдачу." : "Курьер отвечает за физическую доставку после назначения."}</CardDescription></div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">{attention.map((item) => <Badge key={item} variant="muted">{item}</Badge>)}</div>
        <GuideSection title={isPartner ? "Что партнёр может делать" : "Что курьер может делать"} items={canItems} tone="success" />
        <GuideSection title={isPartner ? "Что партнёр не может делать" : "Что курьер не может делать"} items={cannotItems} tone="danger" />
        <GuideSection title="Когда нужен администратор" items={adminCases} tone="warning" />
        <GuideSection title="Ограничения AI-диспетчера" items={aiLimits} tone="info" />
        <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm leading-6 text-foreground">Регулируемые модули отключены в текущей версии. Их будущая активация возможна только после юридической проверки, подтверждения партнёров и отдельного административного разрешения.</div>
      </CardContent>
    </Card>
  );
}

function GuideSection({ items, title, tone }: { items: string[]; title: string; tone: "success" | "danger" | "warning" | "info" }) {
  const toneLabel = { success: "Можно", danger: "Ограничение", warning: "Внимание", info: "Информация" }[tone];
  return <div className="rounded-md border border-border bg-background/80 p-3"><div className="mb-2 flex items-center justify-between gap-2"><p className="text-sm font-semibold text-foreground">{title}</p><Badge variant={tone}>{toneLabel}</Badge></div><ul className="space-y-1 text-sm leading-5 text-muted">{items.map((item) => <li className="break-words" key={item}>{item}</li>)}</ul></div>;
}

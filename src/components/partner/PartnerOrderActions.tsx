import { randomUUID } from "node:crypto";
import type { ReactNode } from "react";
import { partnerOrderFormAction, type PartnerOrderAction } from "@/app/actions/partner/partnerOrders";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

type PartnerOrderActionsProps = {
  orderId: string;
  orderType: "food" | "shop";
  status: string;
  className?: string;
  compact?: boolean;
  detailHref?: string;
  backHref?: string;
};

const orderFlow = ["Новый", "Принят партнёром", "В приготовлении", "Готов к выдаче", "Физическая доставка отдельно"];

export function PartnerOrderActions({
  backHref,
  className,
  compact = false,
  detailHref,
  orderId,
  orderType,
  status
}: PartnerOrderActionsProps) {
  const returnTo = backHref ? `/partner/orders/${orderId}` : "/partner/orders";
  const canAccept = status === "new";
  const canRejectFood = status === "new" && orderType === "food";
  const shopRejectBlocked = status === "new" && orderType === "shop";
  const canStartPreparing = status === "accepted_by_partner";
  const canMarkReady = status === "preparing";
  const canReportIssue = ["new", "accepted_by_partner", "preparing", "ready_for_pickup"].includes(status);
  const canRequestCancellation = ["accepted_by_partner", "preparing", "ready_for_pickup"].includes(status);
  const hasOperationalAction = canAccept || canRejectFood || canStartPreparing || canMarkReady || canReportIssue || canRequestCancellation;

  return (
    <Card className={cn("border-primary/15 bg-background/80", className)}>
      <CardHeader className={compact ? "p-4 pb-3" : undefined}>
        <Badge className="w-fit" variant="info">Order status actions</Badge>
        <CardTitle className={compact ? "text-base" : undefined}>Управление заказом</CardTitle>
        <CardDescription>
          Действия проходят через partner-scoped atomic RPC. Оплата, цена, состав заказа и физическая доставка здесь не изменяются.
        </CardDescription>
      </CardHeader>
      <CardContent className={cn("space-y-3", compact ? "p-4 pt-0" : undefined)}>
        <div className="flex flex-wrap gap-2">
          {orderFlow.map((step) => <Badge key={step} variant="muted">{step}</Badge>)}
        </div>
        <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm font-medium text-foreground">
          Самовывоз остаётся отдельным от courier dispatch. Запрос отмены только фиксируется для проверки и не отменяет заказ, не возвращает деньги и не восстанавливает склад автоматически.
        </p>
        {shopRejectBlocked ? (
          <p className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-foreground">
            Отклонение нового Shop-заказа заблокировано до утверждённого atomic restock contract: склад был уменьшен при создании заказа.
          </p>
        ) : null}
      </CardContent>
      <CardFooter className={cn("flex flex-wrap gap-2", compact ? "p-4 pt-0" : undefined)}>
        {canAccept ? <OrderActionForm action="accept" label="Принять заказ" orderId={orderId} returnTo={returnTo} /> : null}
        {canRejectFood ? <OrderActionForm action="reject" label="Отклонить заказ" orderId={orderId} returnTo={returnTo} variant="danger" /> : null}
        {canStartPreparing ? <OrderActionForm action="start_preparing" label="Начать приготовление" orderId={orderId} returnTo={returnTo} variant="outline" /> : null}
        {canMarkReady ? <OrderActionForm action="mark_ready" label="Готов к выдаче" orderId={orderId} returnTo={returnTo} variant="secondary" /> : null}
        {canRequestCancellation ? <OrderActionForm action="request_cancellation" label="Запросить отмену" orderId={orderId} returnTo={returnTo} variant="outline" /> : null}
        {canReportIssue ? <OrderActionForm action="report_issue" label="Сообщить проблему" orderId={orderId} returnTo={returnTo} variant="ghost" /> : null}
        {!hasOperationalAction && !shopRejectBlocked ? <Badge variant="muted">Для текущего статуса действий партнёра нет</Badge> : null}
        {detailHref ? <StyledLink href={detailHref}>Детали</StyledLink> : null}
        {backHref ? <StyledLink href={backHref}>Назад к заказам</StyledLink> : null}
      </CardFooter>
    </Card>
  );
}

function OrderActionForm({
  action,
  label,
  orderId,
  returnTo,
  variant = "primary"
}: {
  action: PartnerOrderAction;
  label: string;
  orderId: string;
  returnTo: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
}) {
  return (
    <form action={partnerOrderFormAction}>
      <input name="orderId" type="hidden" value={orderId} />
      <input name="action" type="hidden" value={action} />
      <input name="requestId" type="hidden" value={`partner-order-${randomUUID()}`} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <Button type="submit" variant={variant}>{label}</Button>
    </form>
  );
}

function StyledLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary" href={href}>
      {children}
    </a>
  );
}

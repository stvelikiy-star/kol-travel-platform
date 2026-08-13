import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

type PartnerOrderActionsProps = {
  className?: string;
  compact?: boolean;
  detailHref?: string;
  backHref?: string;
};

const orderFlow = ["Новая заявка", "Принять заказ", "В приготовлении", "Готов к выдаче", "Ожидает курьера", "Передано курьеру"];

export function PartnerOrderActions({
  backHref,
  className,
  compact = false,
  detailHref
}: PartnerOrderActionsProps) {
  return (
    <Card className={cn("border-primary/15 bg-background/80", className)}>
      <CardHeader className={compact ? "p-4 pb-3" : undefined}>
        <Badge className="w-fit" variant="info">Order status actions</Badge>
        <CardTitle className={compact ? "text-base" : undefined}>Partner order demo actions</CardTitle>
        <CardDescription>
          UI-only flow: accept/reject, start preparation, mark ready_for_pickup, then wait for courier handoff.
        </CardDescription>
      </CardHeader>
      <CardContent className={cn("space-y-3", compact ? "p-4 pt-0" : undefined)}>
        <div className="flex flex-wrap gap-2">
          {orderFlow.map((step) => (
            <Badge key={step} variant="muted">{step}</Badge>
          ))}
        </div>
        <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm font-medium text-foreground">
          Partner controls preparation and availability only. After courier pickup, delivery is outside partner zone.
          Partner cannot change payment status or cancel after pickup without admin escalation.
        </p>
      </CardContent>
      <CardFooter className={compact ? "p-4 pt-0" : undefined}>
        <Button>Принять заказ demo</Button>
        <Button variant="danger">Отклонить demo</Button>
        <Button variant="outline">Начать приготовление demo</Button>
        <Button variant="secondary">Готов к выдаче demo</Button>
        <Button variant="ghost">Сообщить проблему demo</Button>
        <Button disabled variant="outline">Связаться с админом demo</Button>
        {detailHref ? <StyledLink href={detailHref}>Детали demo</StyledLink> : null}
        {backHref ? <StyledLink href={backHref}>Назад к заказам</StyledLink> : null}
      </CardFooter>
    </Card>
  );
}

function StyledLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a
      className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary"
      href={href}
    >
      {children}
    </a>
  );
}

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

type PartnerBookingActionsProps = {
  className?: string;
  compact?: boolean;
  detailHref?: string;
  backHref?: string;
};

const bookingFlow = ["Новая бронь", "Подтвердить бронь", "Ожидает гостя", "Гость прибыл", "Завершено", "Админ для отмены"];

export function PartnerBookingActions({
  backHref,
  className,
  compact = false,
  detailHref
}: PartnerBookingActionsProps) {
  return (
    <Card className={cn("border-primary/15 bg-background/80", className)}>
      <CardHeader className={compact ? "p-4 pb-3" : undefined}>
        <Badge className="w-fit" variant="info">Booking status actions</Badge>
        <CardTitle className={compact ? "text-base" : undefined}>Partner booking demo actions</CardTitle>
        <CardDescription>
          UI-only flow: confirm/reject booking, wait for guest, mark arrival and completion later.
        </CardDescription>
      </CardHeader>
      <CardContent className={cn("space-y-3", compact ? "p-4 pt-0" : undefined)}>
        <div className="flex flex-wrap gap-2">
          {bookingFlow.map((step) => (
            <Badge key={step} variant="muted">{step}</Badge>
          ))}
        </div>
        <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm font-medium text-foreground">
          Partner controls booking confirmation and availability. Confirmed booking changes or cancellation require admin escalation and audit rules.
          Partner cannot change payment status.
        </p>
      </CardContent>
      <CardFooter className={compact ? "p-4 pt-0" : undefined}>
        <Button>Подтвердить бронь demo</Button>
        <Button variant="danger">Отклонить demo</Button>
        <Button variant="outline">Изменить demo</Button>
        <Button disabled variant="outline">Изменение требует админа demo</Button>
        <Button variant="ghost">Сообщить проблему demo</Button>
        {detailHref ? <StyledLink href={detailHref}>Детали demo</StyledLink> : null}
        {backHref ? <StyledLink href={backHref}>Назад к броням</StyledLink> : null}
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

import { randomUUID } from "node:crypto";
import { partnerAvailabilityFormAction, type PartnerAvailabilityScopeType } from "@/app/actions/partner/partnerAvailability";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/Card";
import { cn } from "@/lib/cn";

export type PartnerAvailabilityType = "room" | "tour" | "restaurant" | "product";

export type PartnerAvailabilityDateStatus = "available" | "limited" | "closed" | "stopped";

export type PartnerAvailabilityOperation = {
  scopeType: PartnerAvailabilityScopeType;
  scopeId: string;
  returnTo: "/partner/availability/rooms" | "/partner/availability/tours";
  canOpen: boolean;
};

export type PartnerAvailabilityDate = {
  date: string;
  label: string;
  status: PartnerAvailabilityDateStatus;
  operation?: PartnerAvailabilityOperation;
};

type PartnerAvailabilityCalendarCardProps = {
  title: string;
  type: PartnerAvailabilityType;
  dates: PartnerAvailabilityDate[];
  note?: string;
  className?: string;
};

const statusVariant: Record<PartnerAvailabilityDateStatus, BadgeVariant> = {
  available: "success",
  limited: "warning",
  closed: "muted",
  stopped: "danger"
};

export function PartnerAvailabilityCalendarCard({
  className,
  dates,
  note,
  title,
  type
}: PartnerAvailabilityCalendarCardProps) {
  const hasOperationalControls = dates.some((item) => item.operation);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>
              {hasOperationalControls
                ? "Доступность читается из Supabase и изменяется только через защищённый серверный RPC."
                : "Demo availability calendar for partner operations."}
            </CardDescription>
          </div>
          <Badge variant="info">{type}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {dates.map((item) => (
            <div className="rounded-lg border border-border bg-background p-4" key={`${item.date}-${item.label}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold text-foreground">{item.date}</p>
                <Badge variant={statusVariant[item.status]}>{item.status}</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted">{item.label}</p>
              {item.operation ? <OperationalControls item={item} /> : null}
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm leading-6 text-foreground">
          {note ?? "Closing dates affects only new orders/bookings. Accepted bookings/orders are not cancelled."}
        </div>
      </CardContent>
      {!hasOperationalControls ? (
        <CardFooter>
          <Button variant="secondary">Open date demo</Button>
          <Button variant="outline">Close date demo</Button>
          <Button variant="outline">Limit demo</Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}

function OperationalControls({ item }: { item: PartnerAvailabilityDate }) {
  const operation = item.operation;
  if (!operation) return null;

  const isOpen = item.status === "available" || item.status === "limited";
  const primaryAction = isOpen ? "close" : "open";
  const primaryLabel = isOpen ? "Закрыть дату" : "Открыть дату";
  const primaryDisabled = primaryAction === "open" && !operation.canOpen;

  return (
    <div className="mt-4 grid gap-2">
      <form action={partnerAvailabilityFormAction}>
        <AvailabilityHiddenFields
          action={primaryAction}
          operation={operation}
          reason={isOpen
            ? "Partner closed future availability from operational calendar."
            : "Partner reopened future availability from operational calendar."}
        />
        <Button className="w-full" disabled={primaryDisabled} type="submit" variant={isOpen ? "danger" : "secondary"}>
          {primaryLabel}
        </Button>
      </form>
      <form action={partnerAvailabilityFormAction}>
        <AvailabilityHiddenFields
          action="report_conflict"
          operation={operation}
          reason="Partner reported an availability conflict from operational calendar."
        />
        <Button className="w-full" type="submit" variant="outline">
          Сообщить конфликт
        </Button>
      </form>
      {primaryDisabled ? (
        <p className="text-xs leading-5 text-danger">
          Открытие запрещено: свободный inventory исчерпан. Счётчики не восстанавливаются вручную.
        </p>
      ) : null}
    </div>
  );
}

function AvailabilityHiddenFields({
  action,
  operation,
  reason
}: {
  action: "close" | "open" | "report_conflict";
  operation: PartnerAvailabilityOperation;
  reason: string;
}) {
  return (
    <>
      <input name="scopeType" type="hidden" value={operation.scopeType} />
      <input name="scopeId" type="hidden" value={operation.scopeId} />
      <input name="action" type="hidden" value={action} />
      <input name="requestId" type="hidden" value={`availability-${action}-${randomUUID()}`} />
      <input name="reason" type="hidden" value={reason} />
      <input name="returnTo" type="hidden" value={operation.returnTo} />
    </>
  );
}

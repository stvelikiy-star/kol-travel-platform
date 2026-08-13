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

type StopScopeType =
  | "business"
  | "delivery"
  | "new_orders"
  | "booking"
  | "tour"
  | "room"
  | "food_item"
  | "product";

type StopScopeStatus = "active" | "paused" | "stopped" | "limited";

type PartnerStopScopeCardProps = {
  title: string;
  scopeType: StopScopeType;
  status: StopScopeStatus;
  description: string;
  affectedArea: string;
  safetyNote: string;
  className?: string;
};

const statusVariant: Record<StopScopeStatus, BadgeVariant> = {
  active: "success",
  paused: "warning",
  stopped: "danger",
  limited: "info"
};

export function PartnerStopScopeCard({
  affectedArea,
  className,
  description,
  safetyNote,
  scopeType,
  status,
  title
}: PartnerStopScopeCardProps) {
  return (
    <Card className={cn("border-warning/30 bg-warning/10", className)}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Badge className="w-fit" variant={statusVariant[status]}>
              {status}
            </Badge>
            <CardTitle className="mt-3">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge variant="muted">{scopeType}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Affected scope</p>
          <p className="mt-2 text-sm font-semibold text-foreground">{affectedArea}</p>
        </div>
        <div className="rounded-lg border border-warning/40 bg-background p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-warning">Safety note</p>
          <p className="mt-2 text-sm leading-6 text-foreground">{safetyNote}</p>
          <p className="mt-3 text-sm font-semibold text-foreground">
            Stop action does not delete the item and does not cancel accepted orders/bookings.
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline">Pause 30 min demo</Button>
        <Button variant="outline">Pause until end of day demo</Button>
        <Button variant="danger">Stop demo</Button>
        <Button variant="secondary">Resume demo</Button>
      </CardFooter>
    </Card>
  );
}

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

export type PartnerAvailabilityDate = {
  date: string;
  label: string;
  status: PartnerAvailabilityDateStatus;
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
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>
              Demo availability calendar for partner operations.
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
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm leading-6 text-foreground">
          {note ?? "Closing dates affects only new orders/bookings. Accepted bookings/orders are not cancelled."}
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="secondary">Open date demo</Button>
        <Button variant="outline">Close date demo</Button>
        <Button variant="outline">Limit demo</Button>
      </CardFooter>
    </Card>
  );
}

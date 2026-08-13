import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

export type PartnerTimelineStepStatus = "done" | "current" | "upcoming" | "warning";

export type PartnerTimelineStep = {
  label: string;
  description: string;
  status: PartnerTimelineStepStatus;
};

type PartnerStatusTimelineProps = {
  title: string;
  steps: PartnerTimelineStep[];
  description?: string;
  className?: string;
};

const statusVariant: Record<PartnerTimelineStepStatus, BadgeVariant> = {
  done: "success",
  current: "info",
  upcoming: "muted",
  warning: "warning"
};

export function PartnerStatusTimeline({
  className,
  description = "Demo timeline for partner CRM workflow.",
  steps,
  title
}: PartnerStatusTimelineProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 lg:grid-cols-3">
          {steps.map((step, index) => (
            <div
              className={cn(
                "relative rounded-lg border bg-background p-4",
                step.status === "current" ? "border-primary shadow-sm" : "border-border"
              )}
              key={`${step.label}-${index}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-sm font-semibold text-primary">
                  {index + 1}
                </div>
                <Badge variant={statusVariant[step.status]}>{step.status}</Badge>
              </div>
              <p className="mt-4 font-semibold text-foreground">{step.label}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{step.description}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

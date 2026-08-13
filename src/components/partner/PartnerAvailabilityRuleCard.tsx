import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

type PartnerAvailabilityRuleCardProps = {
  title: string;
  rules: string[];
  warning?: string;
  className?: string;
};

export function PartnerAvailabilityRuleCard({
  className,
  rules,
  title,
  warning
}: PartnerAvailabilityRuleCardProps) {
  return (
    <Card className={cn("border-primary/15", className)}>
      <CardHeader>
        <Badge className="w-fit" variant="info">
          availability rules
        </Badge>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Demo operational rules for future availability controls.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2">
          {rules.map((rule) => (
            <div
              className="rounded-md border border-border bg-background p-3 text-sm font-medium text-foreground"
              key={rule}
            >
              {rule}
            </div>
          ))}
        </div>
        {warning ? (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
            <Badge variant="warning">warning</Badge>
            <p className="mt-3 text-sm leading-6 text-foreground">{warning}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

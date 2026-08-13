import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

type PartnerWarningTone = "info" | "warning" | "danger" | "success";

type PartnerWarningCardProps = {
  title: string;
  description: string;
  items?: string[];
  tone?: PartnerWarningTone;
  className?: string;
};

const toneStyles: Record<PartnerWarningTone, { card: string; badge: BadgeVariant }> = {
  info: { card: "border-primary/25 bg-primary/10", badge: "info" },
  warning: { card: "border-warning/40 bg-warning/10", badge: "warning" },
  danger: { card: "border-danger/30 bg-danger/10", badge: "danger" },
  success: { card: "border-success/30 bg-success/10", badge: "success" }
};

export function PartnerWarningCard({
  className,
  description,
  items,
  title,
  tone = "warning"
}: PartnerWarningCardProps) {
  const style = toneStyles[tone];

  return (
    <Card className={cn(style.card, className)}>
      <CardHeader>
        <Badge className="w-fit" variant={style.badge}>
          {tone}
        </Badge>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {items && items.length > 0 ? (
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <div
              className="rounded-md border border-border/70 bg-surface/70 p-3 text-sm font-medium text-foreground"
              key={item}
            >
              {item}
            </div>
          ))}
        </CardContent>
      ) : null}
    </Card>
  );
}

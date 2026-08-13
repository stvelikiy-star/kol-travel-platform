import { Badge, type BadgeVariant } from "@/components/ui/Badge";

type StatusBadgeProps = {
  label: string;
  variant: BadgeVariant;
  className?: string;
};

export function StatusBadge({ label, variant, className }: StatusBadgeProps) {
  return (
    <Badge className={className} variant={variant}>
      {label}
    </Badge>
  );
}

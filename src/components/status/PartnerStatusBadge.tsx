import type { PartnerStatus } from "@/types";
import type { BadgeVariant } from "@/components/ui/Badge";
import { StatusBadge } from "@/components/ui/StatusBadge";

type StatusConfig = {
  label: string;
  variant: BadgeVariant;
  description: string;
};

const partnerStatusConfig: Record<PartnerStatus, StatusConfig> = {
  pending: {
    label: "На проверке",
    variant: "warning",
    description: "Партнёр ожидает модерации."
  },
  approved: {
    label: "Одобрен",
    variant: "success",
    description: "Партнёр может работать в платформе."
  },
  suspended: {
    label: "Приостановлен",
    variant: "danger",
    description: "Доступ партнёра временно ограничен."
  },
  rejected: {
    label: "Отклонён",
    variant: "danger",
    description: "Партнёр не прошёл модерацию."
  },
  archived: {
    label: "Архив",
    variant: "muted",
    description: "Партнёр перенесён в архив."
  }
};

type PartnerStatusBadgeProps = {
  status: PartnerStatus;
  className?: string;
};

export function PartnerStatusBadge({ status, className }: PartnerStatusBadgeProps) {
  const config = partnerStatusConfig[status];

  return <StatusBadge className={className} label={config.label} variant={config.variant} />;
}

export { partnerStatusConfig };

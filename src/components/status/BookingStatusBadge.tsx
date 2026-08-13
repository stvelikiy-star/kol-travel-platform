import type { BookingStatus } from "@/types";
import type { BadgeVariant } from "@/components/ui/Badge";
import { StatusBadge } from "@/components/ui/StatusBadge";

type StatusConfig = {
  label: string;
  variant: BadgeVariant;
  description: string;
};

const bookingStatusConfig: Record<BookingStatus, StatusConfig> = {
  pending: {
    label: "Ожидает",
    variant: "warning",
    description: "Бронь создана и ждёт подтверждения."
  },
  confirmed: {
    label: "Подтверждена",
    variant: "success",
    description: "Партнёр подтвердил бронь."
  },
  checked_in: {
    label: "Check-in",
    variant: "info",
    description: "Клиент заселился."
  },
  completed: {
    label: "Завершена",
    variant: "success",
    description: "Бронь успешно завершена."
  },
  cancelled: {
    label: "Отменена",
    variant: "muted",
    description: "Бронь отменена по отдельному cancel flow."
  },
  rejected: {
    label: "Отклонена",
    variant: "danger",
    description: "Партнёр отклонил бронь."
  },
  no_show: {
    label: "No-show",
    variant: "danger",
    description: "Клиент не пришёл или не заселился."
  }
};

type BookingStatusBadgeProps = {
  status: BookingStatus;
  className?: string;
};

export function BookingStatusBadge({ status, className }: BookingStatusBadgeProps) {
  const config = bookingStatusConfig[status];

  return <StatusBadge className={className} label={config.label} variant={config.variant} />;
}

export { bookingStatusConfig };

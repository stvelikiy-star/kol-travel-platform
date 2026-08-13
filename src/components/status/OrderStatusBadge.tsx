import type { OrderStatus } from "@/types";
import type { BadgeVariant } from "@/components/ui/Badge";
import { StatusBadge } from "@/components/ui/StatusBadge";

export type ExtendedOrderStatus = OrderStatus | "age_check" | "age_check_failed";

type StatusConfig = {
  label: string;
  variant: BadgeVariant;
  description: string;
};

const orderStatusConfig: Record<ExtendedOrderStatus, StatusConfig> = {
  new: {
    label: "Новый",
    variant: "info",
    description: "Заказ создан и ожидает реакции партнёра."
  },
  accepted: {
    label: "Принят",
    variant: "success",
    description: "Партнёр принял заказ в работу."
  },
  preparing: {
    label: "Готовится",
    variant: "warning",
    description: "Еда готовится партнёром."
  },
  assembling: {
    label: "Собирается",
    variant: "warning",
    description: "Товары собираются магазином."
  },
  ready: {
    label: "Готов",
    variant: "success",
    description: "Заказ готов к выдаче или доставке."
  },
  delivering: {
    label: "В доставке",
    variant: "info",
    description: "Заказ передан в доставку."
  },
  completed: {
    label: "Завершён",
    variant: "success",
    description: "Заказ успешно завершён."
  },
  rejected: {
    label: "Отклонён",
    variant: "danger",
    description: "Партнёр отклонил заказ."
  },
  cancelled: {
    label: "Отменён",
    variant: "muted",
    description: "Заказ отменён по отдельному cancel flow."
  },
  age_check: {
    label: "Проверка 18+",
    variant: "warning",
    description: "Технический alcohol status; модуль выключен до юридического approval."
  },
  age_check_failed: {
    label: "18+ не пройден",
    variant: "danger",
    description: "Технический alcohol status; заказ нельзя завершить без проверки возраста."
  }
};

type OrderStatusBadgeProps = {
  status: ExtendedOrderStatus;
  className?: string;
};

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const config = orderStatusConfig[status];

  return (
    <StatusBadge
      className={className}
      label={config.label}
      variant={config.variant}
    />
  );
}

export { orderStatusConfig };

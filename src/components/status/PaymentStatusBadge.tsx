import type { PaymentStatus } from "@/types";
import type { BadgeVariant } from "@/components/ui/Badge";
import { StatusBadge } from "@/components/ui/StatusBadge";

export type ExtendedPaymentStatus = PaymentStatus | "partially_refunded" | "cod";

type StatusConfig = {
  label: string;
  variant: BadgeVariant;
  description: string;
};

const paymentStatusConfig: Record<ExtendedPaymentStatus, StatusConfig> = {
  pending: {
    label: "Ожидает оплаты",
    variant: "warning",
    description: "Оплата ещё не подтверждена."
  },
  paid: {
    label: "Оплачено",
    variant: "success",
    description: "Оплата получена."
  },
  failed: {
    label: "Ошибка оплаты",
    variant: "danger",
    description: "Оплата не прошла."
  },
  refunded: {
    label: "Возврат",
    variant: "info",
    description: "Средства возвращены."
  },
  partially_refunded: {
    label: "Частичный возврат",
    variant: "info",
    description: "Возвращена часть суммы."
  },
  cancelled: {
    label: "Отменено",
    variant: "muted",
    description: "Оплата отменена."
  },
  cod: {
    label: "Оплата при получении",
    variant: "default",
    description: "Cash on delivery / оплата при получении."
  }
};

type PaymentStatusBadgeProps = {
  status: ExtendedPaymentStatus;
  className?: string;
};

export function PaymentStatusBadge({ status, className }: PaymentStatusBadgeProps) {
  const config = paymentStatusConfig[status];

  return <StatusBadge className={className} label={config.label} variant={config.variant} />;
}

export { paymentStatusConfig };

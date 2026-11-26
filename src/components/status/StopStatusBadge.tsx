import type { BusinessStatus, StopType } from "@/types";
import type { BadgeVariant } from "@/components/ui/Badge";
import { StatusBadge } from "@/components/ui/StatusBadge";

export type StopStatus = BusinessStatus | StopType;

type StatusConfig = {
  label: string;
  variant: BadgeVariant;
  description: string;
};

const stopStatusConfig: Record<StopStatus, StatusConfig> = {
  online: {
    label: "Работает",
    variant: "success",
    description: "Бизнес принимает новые заказы и брони."
  },
  paused: {
    label: "Пауза",
    variant: "warning",
    description: "Бизнес временно ограничен."
  },
  offline: {
    label: "Не работает",
    variant: "muted",
    description: "Бизнес не принимает новые операции."
  },
  stop_business: {
    label: "Приём заказов остановлен",
    variant: "danger",
    description: "Новые заказы и брони по бизнесу заблокированы."
  },
  stop_delivery: {
    label: "Доставка остановлена",
    variant: "warning",
    description: "Новая доставка заблокирована, самовывоз может быть доступен."
  },
  stop_new_orders: {
    label: "Новые заказы остановлены",
    variant: "warning",
    description: "Новые заказы временно не принимаются."
  },
  stop_item: {
    label: "Блюдо недоступно",
    variant: "warning",
    description: "Конкретное блюдо скрыто от новых заказов."
  },
  stop_product: {
    label: "Товар недоступен",
    variant: "warning",
    description: "Конкретный товар недоступен для новых заказов."
  },
  stop_room: {
    label: "Номер недоступен",
    variant: "warning",
    description: "Конкретный номер недоступен для новых броней."
  },
  stop_tour: {
    label: "Тур недоступен",
    variant: "warning",
    description: "Тур или дата тура недоступны для новых броней."
  },
  pause_30: {
    label: "Пауза 30 мин",
    variant: "info",
    description: "Автоматическая пауза на 30 минут."
  },
  pause_until_eod: {
    label: "До конца дня",
    variant: "info",
    description: "Пауза до конца рабочего дня."
  },
  manual_resume: {
    label: "До ручного включения",
    variant: "muted",
    description: "Пауза активна до ручного возобновления."
  }
};

type StopStatusBadgeProps = {
  status: StopStatus;
  className?: string;
};

export function StopStatusBadge({ status, className }: StopStatusBadgeProps) {
  const config = stopStatusConfig[status];

  return <StatusBadge className={className} label={config.label} variant={config.variant} />;
}

export { stopStatusConfig };

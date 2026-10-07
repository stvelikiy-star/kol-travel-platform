export const supportCategoryLabels: Record<string, string> = {
  general: "Общий вопрос",
  booking: "Бронирование",
  order: "Заказ",
  delivery: "Доставка",
  technical: "Техническая проблема",
  order_request: "Заявка на заказ",
  booking_request: "Заявка на бронирование",
  support: "Обращение"
};

export const supportStatusLabels: Record<string, string> = {
  open: "Новая",
  in_progress: "В работе",
  resolved: "Решена",
  closed: "Закрыта"
};

export const supportPriorityLabels: Record<string, string> = {
  low: "Низкий",
  medium: "Обычный",
  high: "Высокий",
  urgent: "Срочный"
};

export function supportCategoryLabel(value: string) {
  return supportCategoryLabels[value] ?? value;
}

export function supportStatusLabel(value: string) {
  return supportStatusLabels[value] ?? value;
}

export function supportPriorityLabel(value: string) {
  return supportPriorityLabels[value] ?? value;
}

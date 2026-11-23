// Display labels only. Never modify the underlying database status or RPC values.
const order: Record<string, string> = {
  new: "Новый", pending: "Ожидает", accepted: "Принят",
  accepted_by_partner: "Принят партнёром", preparing: "Готовится",
  assembling: "Комплектуется", ready: "Готов", ready_for_pickup: "Готов к выдаче",
  delivering: "В доставке", completed: "Завершён", rejected: "Отклонён",
  cancelled: "Отменён", age_check: "Проверка возраста",
  age_check_failed: "Проверка возраста не пройдена"
};
const booking: Record<string, string> = {
  pending: "Ожидает подтверждения", confirmed: "Подтверждена",
  checked_in: "Гость заселён", completed: "Завершена",
  cancelled: "Отменена", rejected: "Отклонена", no_show: "Гость не прибыл"
};
const payment: Record<string, string> = {
  pending: "Ожидает оплаты", paid: "Оплачено",
  failed: "Ошибка оплаты", refunded: "Возврат выполнен",
  partially_refunded: "Частичный возврат", cancelled: "Оплата отменена",
  cod: "Оплата при получении", awaiting_confirmation: "Ожидает подтверждения"
};
const delivery: Record<string, string> = {
  pending: "Ожидает назначения", delivery_pending: "Ожидает доставки",
  assigned: "Назначена курьеру", courier_assigned: "Назначена курьеру",
  courier_accepted: "Принята курьером", courier_to_partner: "Курьер едет к партнёру",
  arrived_at_partner: "Курьер прибыл к партнёру", picked_up: "Заказ получен",
  delivering: "В доставке", courier_to_client: "Курьер едет к клиенту",
  arrived_at_client: "Курьер прибыл к клиенту", delivered: "Доставлено",
  delivery_failed: "Доставка не выполнена", cancelled: "Доставка отменена",
  completed: "Доставлено"
};
const business: Record<string, string> = {
  online: "Работает", offline: "Не работает", paused: "Приостановлено",
  active: "Активно", inactive: "Неактивно",
  available: "Доступно", unavailable: "Недоступно", closed: "Закрыто",
  sold_out: "Нет свободных мест", fully_booked: "Все места заняты",
  draft: "Черновик", under_review: "На проверке", published: "Опубликовано",
  limited: "Ограничено", stopped: "Остановлено",
  pending: "На проверке", approved: "Одобрено",
  suspended: "Приостановлено", rejected: "Отклонено",
  archived: "В архиве", blocked: "Заблокировано"
};
const support: Record<string, string> = {
  new: "Новое обращение", open: "Открыто", pending: "Ожидает",
  in_progress: "В работе", processing: "В работе",
  escalated: "Передано администратору", resolved: "Решено",
  closed: "Закрыто", cancelled: "Отменено", rejected: "Отклонено"
};
const type: Record<string, string> = {
  food: "Еда", shop: "Магазин", tour: "Тур", stay: "Жильё",
  products: "Товары", tours: "Туры", stays: "Жильё", categories: "Категории",
  hotel: "Отель", guest_house: "Гостевой дом",
  restaurant: "Ресторан", cafe: "Кафе",
  tour_operator: "Туроператор", guide: "Гид",
  delivery_service: "Служба доставки", alcohol_partner: "Товары с ограничениями"
};
function label(map: Record<string, string>, status: string | null | undefined) {
  return status ? map[status] ?? "Неизвестный статус" : "Не указан";
}
export const displayOrderStatus = (status: string | null | undefined) => label(order, status);
export const displayBookingStatus = (status: string | null | undefined) => label(booking, status);
export const displayPaymentStatus = (status: string | null | undefined) => label(payment, status);
export const displayDeliveryStatus = (status: string | null | undefined) => label(delivery, status);
export const displayBusinessStatus = (status: string | null | undefined) => label(business, status);
export const displayOrderType = (value: string | null | undefined) => label(type, value);
export const displaySupportStatus = (status: string | null | undefined) => label(support, status);

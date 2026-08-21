import { getBookings } from "@/lib/data/bookings";
import { isSupabaseMode } from "@/lib/data/data-source";
import { getDeliveries, type DeliveryRiskLevel } from "@/lib/data/delivery";
import { getOrders } from "@/lib/data/orders";
import { getPartners } from "@/lib/data/partners";
import { readAdminDashboardFromSupabase } from "@/lib/data/supabase-read-adapter";

export function getAdminDashboardData() {
  if (isSupabaseMode()) {
    const supabaseDashboard = readAdminDashboardFromSupabase();
    if (supabaseDashboard) return supabaseDashboard;
  }

  const orders = getOrders();
  const bookings = getBookings();
  const partners = getPartners();
  const deliveries = getDeliveries();

  return {
    ordersCount: orders.length,
    activeOrdersCount: orders.filter((order) => order.status !== "completed" && order.status !== "cancelled").length,
    bookingsCount: bookings.length,
    activeBookingsCount: bookings.filter((booking) => booking.status === "pending" || booking.status === "confirmed").length,
    partnersCount: partners.length,
    deliveriesCount: deliveries.length,
    highRiskDeliveriesCount: deliveries.filter((delivery) => delivery.riskLevel === "high" || delivery.riskLevel === "critical").length
  };
}

export function getAdminOrders() {
  return getOrders();
}

export function getAdminBookings() {
  return getBookings();
}

export function getAdminDeliveryRisks(): Array<{
  orderId: string;
  riskLevel: DeliveryRiskLevel;
  reason: string;
}> {
  return getDeliveries().map((delivery) => ({
    orderId: delivery.orderId,
    riskLevel: delivery.riskLevel,
    reason: getRiskReason(delivery.riskLevel)
  }));
}

export function getAIRecommendationsDemo() {
  return getAdminDeliveryRisks().map((risk) => ({
    id: `ai-rec-${risk.orderId}`,
    sourceType: "delivery" as const,
    sourceId: risk.orderId,
    riskLevel: risk.riskLevel,
    recommendedAction: risk.riskLevel === "high" || risk.riskLevel === "critical"
      ? "Перед выполнением действия передать ситуацию администратору."
      : "Продолжить наблюдение за доставкой и текущим статусом.",
    humanApprovalRequired: risk.riskLevel === "high" || risk.riskLevel === "critical"
  }));
}

function getRiskReason(riskLevel: DeliveryRiskLevel) {
  switch (riskLevel) {
    case "critical":
      return "Критическая ситуация доставки требует решения администратора.";
    case "high":
      return "Доставка или заказ требуют срочного внимания оператора.";
    case "medium":
      return "Подготовка заказа партнёром ещё продолжается.";
    case "low":
    default:
      return "Срочных рисков по доставке нет.";
  }
}

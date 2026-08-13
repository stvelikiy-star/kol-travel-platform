import type { Order } from "@/types";

export const mockOrders: Order[] = [
  {
    id: "order-food-new",
    clientUserId: "client-001",
    businessId: "business-restaurant-naryn",
    type: "food",
    status: "preparing",
    items: [
      { id: "order-item-001", orderId: "order-food-new", itemType: "food", itemId: "food-001", title: "Бешбармак", quantity: 1, unitPrice: 620, totalPrice: 620 },
      { id: "order-item-002", orderId: "order-food-new", itemType: "food", itemId: "food-005", title: "Шашлык из баранины", quantity: 2, unitPrice: 480, totalPrice: 960 }
    ],
    subtotal: 1580,
    deliveryFee: 180,
    total: 1760,
    currency: "KGS",
    paymentStatus: "pending",
    deliveryStatus: "pending",
    createdAt: "2026-06-18T09:30:00+06:00"
  },
  {
    id: "order-shop-new",
    clientUserId: "client-002",
    businessId: "business-shop-sary-oi",
    type: "shop",
    status: "assembling",
    items: [
      { id: "order-item-003", orderId: "order-shop-new", itemType: "product", itemId: "product-001", title: "Вода 1.5 л", quantity: 4, unitPrice: 45, totalPrice: 180 },
      { id: "order-item-004", orderId: "order-shop-new", itemType: "product", itemId: "product-004", title: "Уголь 3 кг", quantity: 1, unitPrice: 260, totalPrice: 260 }
    ],
    subtotal: 440,
    deliveryFee: 150,
    total: 590,
    currency: "KGS",
    paymentStatus: "pending",
    deliveryStatus: "assigned",
    createdAt: "2026-06-18T10:10:00+06:00"
  },
  {
    id: "order-cancelled",
    clientUserId: "client-003",
    businessId: "business-cafe-tamchy",
    type: "food",
    status: "cancelled",
    items: [
      { id: "order-item-005", orderId: "order-cancelled", itemType: "food", itemId: "food-003", title: "Сырники с каймаком", quantity: 1, unitPrice: 320, totalPrice: 320 }
    ],
    subtotal: 320,
    deliveryFee: 120,
    total: 440,
    currency: "KGS",
    paymentStatus: "cancelled",
    deliveryStatus: "cancelled",
    createdAt: "2026-06-17T08:45:00+06:00"
  },
  {
    id: "order-completed",
    clientUserId: "client-004",
    businessId: "business-shop-sary-oi",
    type: "shop",
    status: "completed",
    items: [
      { id: "order-item-006", orderId: "order-completed", itemType: "product", itemId: "product-005", title: "Пляжный зонт", quantity: 1, unitPrice: 1450, totalPrice: 1450 }
    ],
    subtotal: 1450,
    deliveryFee: 150,
    total: 1600,
    currency: "KGS",
    paymentStatus: "paid",
    deliveryStatus: "delivered",
    createdAt: "2026-06-16T15:20:00+06:00"
  }
];

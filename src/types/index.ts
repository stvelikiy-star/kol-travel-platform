export type UserRole = "guest" | "client" | "partner" | "admin" | "courier" | "support" | "finance";

export type PartnerType =
  | "hotel"
  | "guest_house"
  | "restaurant"
  | "cafe"
  | "shop"
  | "tour_operator"
  | "guide"
  | "delivery_service"
  | "alcohol_partner";

export type FoodOrderStatus =
  | "new"
  | "accepted"
  | "preparing"
  | "ready"
  | "delivering"
  | "completed"
  | "rejected"
  | "cancelled";

export type ShopOrderStatus =
  | "new"
  | "accepted"
  | "assembling"
  | "ready"
  | "delivering"
  | "completed"
  | "rejected"
  | "cancelled";

export type OrderStatus = FoodOrderStatus | ShopOrderStatus;

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "cancelled"
  | "rejected"
  | "no_show";

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded" | "cancelled";
export type DeliveryStatus = "pending" | "assigned" | "picked_up" | "delivering" | "delivered" | "cancelled";
export type PartnerStatus = "pending" | "approved" | "suspended" | "rejected" | "archived";
export type BusinessStatus = "online" | "paused" | "offline";
export type ProductStatus = "active" | "out_of_stock" | "hidden" | "stopped" | "under_review";

export type StopType =
  | "stop_business"
  | "stop_delivery"
  | "stop_new_orders"
  | "stop_item"
  | "stop_product"
  | "stop_room"
  | "stop_tour"
  | "pause_30"
  | "pause_until_eod"
  | "manual_resume";

export type AvailabilityStatus = "available" | "booked" | "blocked";
export type OrderType = "food" | "shop";
export type BookingType = "stay" | "tour";
export type PaymentMethod = "manual" | "cash" | "transfer" | "cod";

export type Tour = {
  id: string;
  businessId: string;
  title: string;
  slug: string;
  location: string;
  description: string;
  price: number;
  currency: "KGS";
  duration: string;
  status: ProductStatus;
  rating: number;
  imageUrl?: string;
};

export type TourSchedule = {
  id: string;
  tourId: string;
  date: string;
  startTime: string;
  capacity: number;
  bookedSeats: number;
  status: AvailabilityStatus;
};

export type Stay = {
  id: string;
  businessId: string;
  title: string;
  slug: string;
  type: "guest_house" | "hotel" | "cottage" | "yurt_camp" | "villa";
  location: string;
  description: string;
  rating: number;
  minPricePerNight: number;
  currency: "KGS";
  status: ProductStatus;
};

export type Room = {
  id: string;
  stayId: string;
  title: string;
  capacity: number;
  pricePerNight: number;
  currency: "KGS";
  status: ProductStatus;
};

export type RoomAvailability = {
  id: string;
  roomId: string;
  date: string;
  status: AvailabilityStatus;
  pricePerNight: number;
};

export type FoodItem = {
  id: string;
  businessId: string;
  category: string;
  title: string;
  description: string;
  price: number;
  currency: "KGS";
  status: ProductStatus;
};

export type Product = {
  id: string;
  businessId: string;
  category: string;
  title: string;
  description: string;
  price: number;
  currency: "KGS";
  status: ProductStatus;
};

export type PartnerBusiness = {
  id: string;
  ownerUserId: string;
  type: PartnerType;
  title: string;
  slug: string;
  location: string;
  description: string;
  status: PartnerStatus;
  businessStatus: BusinessStatus;
  rating: number;
};

export type OrderItem = {
  id: string;
  orderId: string;
  itemType: "food" | "product";
  itemId: string;
  title: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type Order = {
  id: string;
  clientUserId: string;
  businessId: string;
  type: OrderType;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  currency: "KGS";
  paymentStatus: PaymentStatus;
  deliveryStatus?: DeliveryStatus;
  createdAt: string;
};

export type Booking = {
  id: string;
  clientUserId: string;
  businessId: string;
  type: BookingType;
  targetId: string;
  title: string;
  status: BookingStatus;
  startDate: string;
  endDate?: string;
  guests: number;
  total: number;
  currency: "KGS";
  paymentStatus: PaymentStatus;
  createdAt: string;
};

export type Payment = {
  id: string;
  orderId?: string;
  bookingId?: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  currency: "KGS";
};

export type Delivery = {
  id: string;
  orderId: string;
  status: DeliveryStatus;
  address: string;
  phone: string;
  courierUserId?: string;
};

export type PromoCode = {
  id: string;
  code: string;
  discountType: "percent" | "fixed";
  value: number;
  isActive: boolean;
};

export type LoyaltyAccount = {
  id: string;
  userId: string;
  pointsBalance: number;
  tier: "start" | "silver" | "gold";
};

export type Notification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

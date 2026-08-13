export type UserRole =
  | "guest"
  | "client"
  | "partner_owner"
  | "partner_manager"
  | "partner_staff"
  | "courier"
  | "dispatcher"
  | "support_admin"
  | "finance_admin"
  | "super_admin";

export type RecordStatus = "active" | "inactive" | "pending" | "suspended" | "archived";
export type ProductStatus = "active" | "out_of_stock" | "hidden" | "stopped" | "under_review";
export type OrderStatus = "new" | "accepted" | "preparing" | "assembling" | "ready" | "delivering" | "completed" | "rejected" | "cancelled";
export type BookingStatus = "pending" | "confirmed" | "checked_in" | "completed" | "cancelled" | "rejected" | "no_show";
export type DeliveryStatus = "delivery_pending" | "courier_searching" | "courier_assigned" | "courier_accepted" | "courier_to_partner" | "picked_up" | "courier_to_client" | "delivered" | "delivery_failed" | "cancelled";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded" | "partially_refunded" | "cod";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export type BaseRecord = {
  id: string;
  created_at: string;
  updated_at: string;
};

export type UserProfile = BaseRecord & {
  user_id: string;
  role: UserRole;
  full_name: string;
  phone?: string;
  email?: string;
  locale: "ru" | "ky" | "en";
  status: RecordStatus;
};

export type Partner = BaseRecord & {
  owner_user_id: string;
  type: "hotel" | "guest_house" | "restaurant" | "cafe" | "shop" | "tour_operator" | "guide" | "delivery_service";
  title: string;
  slug: string;
  location: string;
  status: RecordStatus;
};

export type Tour = BaseRecord & {
  business_id: string;
  title: string;
  slug: string;
  location: string;
  price: number;
  duration: string;
  status: ProductStatus;
};

export type Stay = BaseRecord & {
  business_id: string;
  title: string;
  slug: string;
  location: string;
  type: string;
  price_from: number;
  status: ProductStatus;
};

export type Product = BaseRecord & {
  business_id: string;
  category_id?: string;
  title: string;
  price: number;
  stock_qty?: number;
  status: ProductStatus;
};

export type Order = BaseRecord & {
  client_id: string;
  business_id: string;
  type: "food" | "shop";
  status: OrderStatus;
  total: number;
  payment_status: PaymentStatus;
};

export type Booking = BaseRecord & {
  client_id: string;
  business_id: string;
  booking_type: "tour" | "stay";
  object_id: string;
  status: BookingStatus;
  start_date: string;
  end_date?: string;
  guests_count: number;
  total: number;
};

export type Delivery = BaseRecord & {
  order_id: string;
  assigned_courier_id?: string;
  status: DeliveryStatus;
  pickup_address: string;
  dropoff_address: string;
  risk_level: RiskLevel;
};

export type Payment = BaseRecord & {
  user_id: string;
  order_id?: string;
  booking_id?: string;
  method: "manual" | "cash" | "transfer" | "cod" | "online";
  status: PaymentStatus;
  amount: number;
};

export type SupportTicket = BaseRecord & {
  created_by: string;
  category: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "resolved" | "closed";
  related_order_id?: string;
  related_booking_id?: string;
};

export type AIRecommendation = BaseRecord & {
  source_type: "order" | "booking" | "delivery";
  source_id: string;
  situation_summary: string;
  risk_level: RiskLevel;
  recommended_action: string;
  human_approval_required: boolean;
  status: "new" | "approved" | "rejected" | "archived";
};

export type AuditLog = BaseRecord & {
  actor_id: string;
  actor_role: UserRole;
  action: string;
  entity_type: string;
  entity_id: string;
  reason?: string;
};

-- KÖL / kol-travel-platform
-- FOREIGN KEY INDEX BASELINE — DRAFT NOT APPLIED
-- Prepared: 2026-08-20 from live pg_constraint + pg_index inspection.
-- Depends on accepted live-schema baseline. Additive only: no DROP INDEX.
--
-- Purpose:
-- - cover currently unindexed single-column foreign keys;
-- - support RLS parent lookups, status/history reads, joins and FK delete/update checks;
-- - remove a large class of Supabase Performance Advisor warnings before real traffic.
--
-- No live apply before backup + migration baseline + staging advisor rerun.

begin;

create index if not exists idx_ai_alerts_event_id on public.ai_alerts(event_id);
create index if not exists idx_ai_decision_logs_approved_by on public.ai_decision_logs(approved_by);
create index if not exists idx_ai_recommendations_event_id on public.ai_recommendations(event_id);
create index if not exists idx_alcohol_module_settings_enabled_by on public.alcohol_module_settings(enabled_by);
create index if not exists idx_audit_logs_actor_id on public.audit_logs(actor_id);

create index if not exists idx_booking_guests_booking_id on public.booking_guests(booking_id);
create index if not exists idx_booking_status_history_booking_id on public.booking_status_history(booking_id);
create index if not exists idx_booking_status_history_changed_by on public.booking_status_history(changed_by);

create index if not exists idx_categories_parent_id on public.categories(parent_id);
create index if not exists idx_commissions_business_id on public.commissions(business_id);
create index if not exists idx_compliance_reviews_reviewed_by on public.compliance_reviews(reviewed_by);

create index if not exists idx_courier_assignments_assigned_by on public.courier_assignments(assigned_by);
create index if not exists idx_courier_assignments_courier_id on public.courier_assignments(courier_id);
create index if not exists idx_courier_assignments_delivery_id on public.courier_assignments(delivery_id);
create index if not exists idx_courier_locations_courier_id on public.courier_locations(courier_id);
create index if not exists idx_courier_shifts_courier_id on public.courier_shifts(courier_id);

create index if not exists idx_delivery_issues_created_by on public.delivery_issues(created_by);
create index if not exists idx_delivery_issues_delivery_id on public.delivery_issues(delivery_id);
create index if not exists idx_delivery_status_history_changed_by on public.delivery_status_history(changed_by);
create index if not exists idx_delivery_status_history_delivery_id on public.delivery_status_history(delivery_id);

create index if not exists idx_loyalty_transactions_account_id on public.loyalty_transactions(account_id);
create index if not exists idx_menu_items_category_id on public.menu_items(category_id);

create index if not exists idx_order_delivery_delivery_id on public.order_delivery(delivery_id);
create index if not exists idx_order_payments_payment_id on public.order_payments(payment_id);
create index if not exists idx_order_status_history_changed_by on public.order_status_history(changed_by);
create index if not exists idx_order_status_history_order_id on public.order_status_history(order_id);

create index if not exists idx_partner_profiles_business_id on public.partner_profiles(business_id);
create index if not exists idx_partners_owner_user_id on public.partners(owner_user_id);

create index if not exists idx_payments_booking_id on public.payments(booking_id);
create index if not exists idx_payments_order_id on public.payments(order_id);

create index if not exists idx_products_category_id on public.products(category_id);
create index if not exists idx_promo_codes_business_id on public.promo_codes(business_id);
create index if not exists idx_promo_usage_booking_id on public.promo_usage(booking_id);
create index if not exists idx_promo_usage_order_id on public.promo_usage(order_id);
create index if not exists idx_promo_usage_promo_code_id on public.promo_usage(promo_code_id);
create index if not exists idx_promo_usage_user_id on public.promo_usage(user_id);

create index if not exists idx_refunds_approved_by on public.refunds(approved_by);
create index if not exists idx_refunds_payment_id on public.refunds(payment_id);

create index if not exists idx_reviews_booking_id on public.reviews(booking_id);
create index if not exists idx_reviews_business_id on public.reviews(business_id);
create index if not exists idx_reviews_client_id on public.reviews(client_id);
create index if not exists idx_reviews_order_id on public.reviews(order_id);

create index if not exists idx_rooms_business_id on public.rooms(business_id);
create index if not exists idx_stays_category_id on public.stays(category_id);

create index if not exists idx_support_tickets_related_booking_id on public.support_tickets(related_booking_id);
create index if not exists idx_support_tickets_related_order_id on public.support_tickets(related_order_id);
create index if not exists idx_ticket_messages_sender_id on public.ticket_messages(sender_id);
create index if not exists idx_ticket_messages_ticket_id on public.ticket_messages(ticket_id);

create index if not exists idx_tours_category_id on public.tours(category_id);

commit;

-- NOTE:
-- The 009 media draft adds uploaded_by -> auth.users; its covering index should be
-- added when the final migration sequence is reconciled because 009 is a separate stack.
--
-- REQUIRED POST-APPLY STAGING CHECK:
-- rerun Supabase Performance Advisor and the live FK/index audit query. Expected:
-- no remaining unindexed single-column FKs from the pre-010 baseline.

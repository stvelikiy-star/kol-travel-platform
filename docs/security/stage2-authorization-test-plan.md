# KÖL authorization verification — isolated environment only

Do NOT execute these tests against the active KÖL database.
The Supabase development branch requires cost consent, so this checklist is intentionally not executed yet.

## Test fixtures
Create two test client accounts A/B, partner businesses A/B, partner staff A/B, couriers A/B, and unrelated orders/bookings/deliveries. Use genuine Auth JWTs and the anonymous key. Seed only the disposable branch.

## Required negative tests
1. Client A cannot SELECT, UPDATE or DELETE client B's order or booking.
2. Partner A cannot SELECT or UPDATE partner B's order.
3. Partner A cannot change client_id, business_id, amount/price or other protected columns in its own order; only approved status transitions may succeed.
4. Courier A cannot SELECT or UPDATE courier B's delivery.
5. Assigned courier cannot replace order_id or other protected delivery columns.
6. Unauthenticated client cannot create or inspect private records.
7. Replayed request ID must not create duplicate orders or bookings.
8. Simultaneous booking requests for the same room/dates must not both succeed.
9. Rejected actions must not write an audit trail claiming success.
10. Backup restored to an isolated database must preserve key constraints and core counts.

## Confirmed read-only findings 2026-10-22
- 54 public tables, 54 have RLS enabled; 22 intentionally or unintentionally have no policy (deny by default).
- authenticated role has UPDATE privilege on orders.client_id, orders.business_id, bookings.client_id, bookings.business_id, deliveries.order_id.
- Existing UPDATE RLS checks ownership, not a complete protected-field update policy.
- client_stay_booking_create_atomic delegates to private SECURITY DEFINER function: inspect its validation, privileges and search path.
- Supabase advisor reports leaked-password protection disabled.

Gate: do not mark security complete or merge authorization migrations until the negative tests above are executed with recorded results.

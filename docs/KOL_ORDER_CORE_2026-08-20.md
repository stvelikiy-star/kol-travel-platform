# KÖL Order Core — 2026-08-20

This note records verified design decisions from the live schema audit.

- Live data is demo-scale: one food order, one menu item, one product.
- Food pricing is authoritative in `menu_items.price`; there is no ingredient stock model, so no ingredient decrement is invented.
- Shop stock is authoritative only when `products.stock_qty` is non-null. Unknown stock fails closed.
- Order monetary fields must be calculated in PostgreSQL, not accepted from the browser.
- The existing partner ready-for-pickup pilot used two independent writes for status and audit. The 008 draft replaces this with one atomic RPC.
- The recovered schema has no authoritative delivery-fee formula. 008 therefore permits pickup only and rejects delivery until a server-side fee model exists.
- One `orders` row belongs to one `business_id`; cross-business carts must be explicitly split or redesigned rather than silently stored as one order.

Files in this stacked draft:

- `supabase/schema/008_order_transaction_core_DRAFT_NOT_APPLIED.sql`
- `supabase/schema/008_order_transaction_core_VERIFY.sql`
- `src/lib/data/order-write-supabase.ts`
- atomic partner ready-for-pickup action integration

No live database change or deployment was performed.

# KÖL staging RLS review (2026-10-23)

Scope: Supabase test project `kol-travel-platform-test` (`mphruawzozrpwcjgejhs`).
This is a role-and-purpose review of the 22 tables reported by the security advisor
as RLS-enabled with no policies. An empty policy set currently denies `anon` and
`authenticated` access; the table remains server-only until a reviewed policy is
applied. `service_role` continues to bypass RLS and must remain server-side.

| Table | Intended API read scope | Write authority |
| --- | --- | --- |
| `ai_alerts` | Active admin roles | Server/service role only |
| `ai_decision_logs` | Active admin roles | Server/service role only |
| `booking_guests` | Authenticated users who can read the parent booking | Booking transaction/RPC only |
| `booking_status_history` | Authenticated users who can read the parent booking | Booking transaction/RPC only |
| `commissions` | Finance/super admins and the owning partner | Server/service role only |
| `compliance_reviews` | Active admin roles | Server/service role only |
| `courier_locations` | Owning courier and dispatch/admin roles | Server/service role or audited RPC only |
| `courier_shifts` | Owning courier and admin roles | Server/service role or audited RPC only |
| `delivery_status_history` | Users who can read the parent delivery | Delivery lifecycle RPC only |
| `favorites` | Owning authenticated user | Owner-only CRUD |
| `loyalty_accounts` | Owning user and admin roles | Server/service role only |
| `loyalty_transactions` | Users who can read the parent loyalty account | Server/service role only |
| `media_files` | Admins for metadata governance | Server/service role; Storage access is controlled separately |
| `notifications` | Owning user and admin roles | Server/service role; mark-read needs a constrained RPC |
| `order_delivery` | Users who can read the parent order | Order/delivery transaction only |
| `order_payments` | Finance admins or users who can read the parent order | Payment RPC/service role only |
| `promo_codes` | Admins and the owning partner | Moderation/transaction flow only |
| `promo_usage` | Owning user and admin roles | Order/booking transaction only |
| `restaurants` | Public/authenticated read when the parent partner is visible | Partner catalog RPC only |
| `reviews` | Author, owning partner, and admins | Keep writes closed until moderation and publication rules are verified |
| `shops` | Public/authenticated read when the parent partner is visible | Partner catalog RPC only |
| `transactions` | Finance/admin roles | Server/service role only |

Draft `006_rls_policy_completion` maps these intended scopes, but it is explicitly
marked `DRAFT_NOT_APPLIED`; it has not been applied to staging. Its VERIFY script
must be run after the required staging migration sequence, and each role scope needs
runtime verification before its findings can be considered closed. The draft also
opens support message reads by ticket access without checking message visibility.
Draft migration `024` handles the two support SELECT warnings separately: one
SELECT policy per support table, with clients limited to their own tickets and
public messages, while support admins can read internal messages.

## Verification state

- Current staging snapshot: all public tables are empty; RLS is enabled on all 54
  public tables.
- The 22-table finding is an INFO signal, and no-policy tables are fail-closed for
  normal API roles. Draft `006` proposes intended reads/writes only where a
  concrete workflow exists; it does not grant generic CRUD. It remains unapplied,
  so all 22 findings are still open in staging.
- The two existing overlapping support SELECT policies were inspected. The broad
  ticket-message policy did not check `visibility`; the revised `006` policy now
  enforces visibility immediately, and `024` is sequenced directly after it.
- No draft policy migration has been applied to the managed staging project in this
  review. Apply remains gated on a verified backup and restore rehearsal, followed
  by authenticated role tests and advisor review.
- Leaked-password protection remains a project Auth setting and is not controlled
  by SQL. It requires a Supabase Auth configuration change plus an Auth smoke test.

# Partner Order Lifecycle Security Review Basis

- Privileged implementation lives in `private`, uses `SECURITY DEFINER`, locked empty `search_path`, schema-qualified references, caller identity from `auth.uid()`, active partner staff + active partner role checks, and business ownership derived from the target order.
- Public Data API entrypoint is `SECURITY INVOKER` and is explicitly executable only by `authenticated`.
- Legacy public `SECURITY DEFINER` ready-for-pickup function is revoked from client roles.
- Direct authenticated order and history writes remain revoked.
- Supabase 2026 guidance on grants/Data API exposure is respected: function/table grants and RLS are treated as separate controls.

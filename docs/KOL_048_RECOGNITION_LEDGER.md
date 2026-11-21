# KÖL 048 — financial recognition ledger (non-settlement)

This is an additive, immutable **double-entry ledger for verified commission recognition**. Nothing here charges cards, refunds money, sends payouts or marks bank settlement.

**Recognition eligibility:** completed order/booking, exactly one paid payment with matching gross amount and applied provider event, no refund record, exactly one OWNER-approved contract covering the subject creation date, and an active OWNER confirmation with idempotency key and audit reason. A second posting of the same subject is rejected except an identical replay. Concurrent submissions use a transaction advisory lock.

**Accounts:** platform-collected payment posts debit `provider_clearing` for gross and credits `platform_commission_revenue` for fee plus `partner_payable` for remainder. Partner-collected payment posts debit `partner_receivable` and credit `platform_commission_revenue` for fee only. This **does not assert the bank has transferred funds**.

**Time basis:** `recognized_at` on the journal, in Asia/Bishkek local reporting dates, not the order creation date. The approved contractual rate is selected by the subject creation date.

**Integrity:** two RLS-protected tables, service-role-only insert/select; updates and deletes rejected by triggers; unique per source and idempotency key; per-journal debit/credit equality verified before return; audit row on each new recognition. No browser service key.

**Still disabled:** refund reversal, payout posting, bank reconciliation, bookkeeping expenses, net profit. The report returns null for bank settlement, actual payouts and net profit. Implement reversal via separate append-only correcting journal, not edits to posted entries.

**QA:** verify SQL with BEGIN/ROLLBACK before migration, synthetic completed/verified order with contract and idempotent replay, mismatch/conflict rejection, cross-tenant report and debit=credit, and no persistent payment/commission/rate changes. Do not deploy until release CI and full browser E2E pass.

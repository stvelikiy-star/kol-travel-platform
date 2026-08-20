# KÖL — Foreign-Key Index Audit

**Date:** 2026-08-20  
**Mode:** live read-only catalog inspection + source-only draft

## Baseline

PostgreSQL catalog inspection of the current public schema found:

- single-column foreign keys: **80**
- without a valid/ready index whose first column covers the FK: **49**

This matches the large `unindexed_foreign_keys` class reported by Supabase Performance Advisor.

## 010 draft

`010_fk_index_baseline_DRAFT_NOT_APPLIED.sql` adds exactly the 49 missing leading indexes from the captured live baseline using `CREATE INDEX IF NOT EXISTS` only.

No index is dropped. In particular, the current `unused_index` advisor notices are deliberately ignored for deletion because the recovered database has almost no real traffic; lack of observed use is not sufficient evidence that an index is unnecessary.

The draft covers booking/order history, payment relations, courier/delivery relations, support, promo/refund, reviews, catalog category relations and other existing foreign keys.

## Gate

Do not apply before the accepted schema baseline and staging. After apply:

1. run `010_fk_index_baseline_VERIFY.sql`;
2. expect zero remaining missing indexes from the pre-010 single-column FK baseline;
3. rerun Supabase Performance Advisor;
4. review new indexes against actual query plans once realistic staging data exists.

The separate 009 media draft creates a new `uploaded_by` FK after this baseline; its final integrated migration should also add an `uploaded_by` covering index.

import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const s=readFileSync("ops/release-sql/kol-owner-cost-accrual-reversal-v1-20261121.sql","utf8");
test("expense and reversing journal are immutable and private",()=>{
 assert.match(s,/kol_finance_cost_journals_v1 ENABLE ROW LEVEL SECURITY/);
 assert.match(s,/kol_finance_cost_entries_v1 ENABLE ROW LEVEL SECURITY/);
 assert.match(s,/private\.kol_finance_reject_mutation_v1/);
 assert.match(s,/cost_idempotency_conflict/);
 assert.match(s,/expense_already_reversed/);
});
test("only active owner may approve costs; postings balanced",()=>{
 assert.match(s,/active_owner_approval_required/);
 assert.match(s,/pg_advisory_xact_lock/);
 assert.match(s,/unbalanced_cost_posting/);
 assert.match(s,/operating_expense','debit'/);
 assert.match(s,/accrued_expense_liability','credit'/);
});
test("no bank payout or profit falsely claimed",()=>{
 assert.match(s,/'actual_bank_outflow',NULL/);
 assert.match(s,/'net_profit',NULL/);
 assert.match(s,/owner_attested_expense_activity/);
});

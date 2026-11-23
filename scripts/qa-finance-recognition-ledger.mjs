import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const sql=readFileSync("ops/release-sql/kol-double-entry-recognition-ledger-20261121.sql","utf8");
test("the journal is append-only, RLS enabled and owner-approved",()=>{
 assert.match(sql,/kol_finance_journals_v1 ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/kol_finance_entries_v1 ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/finance_journal_append_only/);
 assert.match(sql,/active_owner_approval_required/);
 assert.match(sql,/kol_recognition_one_per_subject UNIQUE/);
 assert.match(sql,/pg_advisory_xact_lock/);
});
test("server-only posting and provider event validation",()=>{
 assert.match(sql,/SECURITY INVOKER/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.kol_post_verified_recognition_v1/);
 assert.match(sql,/TO service_role/);
 assert.match(sql,/private\.payment_provider_events/);
 assert.match(sql,/processing_status='applied'/);
 assert.match(sql,/verified_provider_payment_event_required/);
 assert.match(sql,/refund_or_dispute_blocks_recognition/);
 assert.match(sql,/exactly_one_owner_approved_contract_required/);
});
test("balanced debit credit and clear posting date",()=>{
 assert.match(sql,/entry_side='debit'/);
 assert.match(sql,/entry_side='credit'/);
 assert.match(sql,/unbalanced_financial_journal/);
 assert.match(sql,/'date_basis','recognized_at'/);
 assert.match(sql,/'bank_settled',NULL/);
 assert.match(sql,/'net_profit',NULL/);
});

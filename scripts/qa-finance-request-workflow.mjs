import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const sql=readFileSync("ops/release-sql/kol-finance-request-approval-workflow-20261121.sql","utf8");
test("refund/payout request records are immutable with no browser writes",()=>{
 assert.match(sql,/kol_finance_requests_v1 ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/kol_finance_decisions_v1 ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/kol_finance_reject_mutation_v1/);
 assert.match(sql,/REVOKE ALL ON public\.kol_finance_requests_v1/);
 assert.match(sql,/service_role/);
});
test("requests have source scope and idempotent uniqueness",()=>{
 assert.match(sql,/kol_finance_one_refund_request_v1/);
 assert.match(sql,/kol_finance_one_payout_request_v1/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/paid_refund_source_not_eligible/);
 assert.match(sql,/partner_payout_source_not_eligible/);
 assert.match(sql,/requester_not_authorized_for_finance_source/);
});
test("owner decision requires separate approver and never claims to transfer money",()=>{
 assert.match(sql,/independent_owner_approval_required/);
 assert.match(sql,/request_already_decided/);
 assert.match(sql,/money_transferred',false/);
 assert.match(sql,/'actual_refund_executed',NULL/);
 assert.match(sql,/'actual_payout_transferred',NULL/);
});

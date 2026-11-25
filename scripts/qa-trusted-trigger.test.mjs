import assert from "node:assert/strict";
import { test } from "node:test";
import { isTrustedKolQaTrigger } from "./qa-trusted-trigger.mjs";
const repo="stvelikiy-star/kol-travel-platform";
const common={GITHUB_ACTIONS:"true",GITHUB_REPOSITORY:repo,GITHUB_ACTOR:"stvelikiy-star"};
const validPR={...common,GITHUB_EVENT_NAME:"pull_request",GITHUB_HEAD_REF:"release/kol-unified-qa-candidate-20261125",GITHUB_REF:"refs/pull/182/merge"};
const manual={...common,GITHUB_EVENT_NAME:"workflow_dispatch",GITHUB_REF:"refs/heads/feat/kol-superadmin-user-access-20261124"};
test("trusted exact KÖL PR #182 accepted",()=>assert.equal(isTrustedKolQaTrigger(validPR),true));
test("existing owner dispatch retained",()=>assert.equal(isTrustedKolQaTrigger(manual),true));
for(const [what,changes] of [
  ["fork repository", {GITHUB_REPOSITORY:"untrusted/kol-travel-platform"}],
  ["wrong actor", {GITHUB_ACTOR:"untrusted-user"}],
  ["not GitHub Actions", {GITHUB_ACTIONS:"false"}],
  ["other PR", {GITHUB_REF:"refs/pull/183/merge"}],
  ["other head branch", {GITHUB_HEAD_REF:"malicious-branch"}],
  ["push event", {GITHUB_EVENT_NAME:"push",GITHUB_REF:"refs/heads/release/kol-unified-qa-candidate-20261125"}],
  ["unapproved dispatch branch", {GITHUB_EVENT_NAME:"workflow_dispatch",GITHUB_REF:"refs/heads/main"}],
  ["unapproved manual actor", {GITHUB_EVENT_NAME:"workflow_dispatch",GITHUB_REF:"refs/heads/feat/kol-superadmin-user-access-20261124",GITHUB_ACTOR:"untrusted-user"}],
]) test("reject "+what,()=>assert.equal(isTrustedKolQaTrigger({...validPR,...changes}),false));

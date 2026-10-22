import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const draft = readFileSync('supabase/schema/007b_booking_idempotency_serialization_DRAFT_NOT_APPLIED.sql','utf8');
const runtime = readFileSync('scripts/qa-local-supabase-auth-runtime.mjs','utf8');
const expected = ['create_stay_booking_atomic','create_tour_booking_atomic'];
for (const name of expected) {
  assert.match(draft,new RegExp('create or replace function public\\.'+name+'\\s*\\(','i'),'Local draft lacks expected RPC '+name);
  assert(runtime.includes('.rpc("'+name+'"'), 'Local runtime does not verify '+name);
}
const manifest={
  scope:'LOCAL_DRAFT_ONLY',
  draftFunctions:expected,
  remoteVerifiedPublicFunctions:['client_stay_booking_create_atomic'],
  remoteParityConfirmed:false
};
assert.equal(manifest.remoteParityConfirmed,false,'Remote parity cannot be inferred from local smoke');
console.log('KÖL booking local draft contract: PASS');
console.log('REMOTE RPC PARITY: NOT VERIFIED (blocking release gate #150)');

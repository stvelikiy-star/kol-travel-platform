// KÖL isolated Supabase concurrency test. NEVER point at the active project.
// Run only against a disposable Supabase branch with seeded client+rooms.
// Required env: KOL_DISPOSABLE_SUPABASE_URL, KOL_DISPOSABLE_SUPABASE_ANON_KEY,
// KOL_DISPOSABLE_CLIENT_ACCESS_TOKEN, KOL_DISPOSABLE_ROOM_A, KOL_DISPOSABLE_ROOM_B,
// KOL_DISPOSABLE_START_DATE, KOL_DISPOSABLE_END_DATE.
// No credentials or personal data are logged.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const keys = ['KOL_DISPOSABLE_SUPABASE_URL','KOL_DISPOSABLE_SUPABASE_ANON_KEY',
  'KOL_DISPOSABLE_CLIENT_ACCESS_TOKEN','KOL_DISPOSABLE_ROOM_A','KOL_DISPOSABLE_ROOM_B',
  'KOL_DISPOSABLE_START_DATE','KOL_DISPOSABLE_END_DATE'];
const missing = keys.filter((key) => !process.env[key]);
if (missing.length) {
  console.error('ABORTED: explicit disposable branch test configuration is required: ' + missing.join(', '));
  process.exit(2);
}
const env = process.env;
const url = new URL(env.KOL_DISPOSABLE_SUPABASE_URL);
assert(url.protocol === 'https:', 'Supabase API must use HTTPS');
assert(!url.hostname.includes('mphruawzozrpwcjgejhs'), 'Refusing to test against known active KÖL test project');
assert(env.KOL_DISPOSABLE_ROOM_A !== env.KOL_DISPOSABLE_ROOM_B, 'Two distinct rooms required');

async function book(room, requestId, start=env.KOL_DISPOSABLE_START_DATE, end=env.KOL_DISPOSABLE_END_DATE) {
  const response = await fetch(new URL('/rest/v1/rpc/client_stay_booking_create_atomic', url), {
    method: 'POST',
    headers: {
      apikey: env.KOL_DISPOSABLE_SUPABASE_ANON_KEY,
      authorization: 'Bearer ' + env.KOL_DISPOSABLE_CLIENT_ACCESS_TOKEN,
      'content-type': 'application/json'
    },
    body: JSON.stringify({p_room_id:room,p_start_date:start,p_end_date:end,p_guests:1,p_request_id:requestId})
  });
  const data = await response.json();
  return {status:response.status,ok:response.ok,data};
}

const id = randomUUID();
const [a,b] = await Promise.all([
  book(env.KOL_DISPOSABLE_ROOM_A,id),
  book(env.KOL_DISPOSABLE_ROOM_B,id)
]);
const successes = [a,b].filter((x) => x.ok && x.data?.ok && x.data?.idempotent === false);
assert.equal(successes.length, 1, 'Expected exactly one newly created booking; two means duplicate, zero means broken test fixture or booking flow');
// A successful booking followed by the same payload must return that booking.
if (successes.length === 1) {
  const created = a.ok && a.data?.idempotent === false ? a : b;
  const room = created === a ? env.KOL_DISPOSABLE_ROOM_A : env.KOL_DISPOSABLE_ROOM_B;
  const replay = await book(room,id);
  assert(replay.ok && replay.data?.idempotent === true, 'Replay did not return idempotent response');
  assert.equal(replay.data.booking_id,created.data.booking_id,'Replay returned another booking ID');
}
console.log('PASS: concurrent same-client request key across two rooms is not double-created');

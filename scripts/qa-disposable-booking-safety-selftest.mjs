import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const script = 'scripts/qa-disposable-booking-concurrency.mjs';
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('KOL_DISPOSABLE_')));
const missing = spawnSync(process.execPath,[script],{encoding:'utf8',env:cleanEnv});
assert.equal(missing.status,2,'Missing disposable configuration must exit before any network request');
assert.match(missing.stderr,/ABORTED: explicit disposable branch test configuration/);
const hostile = spawnSync(process.execPath,[script],{encoding:'utf8',env:{
  ...cleanEnv,
  KOL_DISPOSABLE_SUPABASE_URL:'https://mphruawzozrpwcjgejhs.supabase.co',
  KOL_DISPOSABLE_PROJECT_REF:'mphruawzozrpwcjgejhs',
  KOL_DISPOSABLE_SUPABASE_ANON_KEY:'dummy',
  KOL_DISPOSABLE_CLIENT_ACCESS_TOKEN:'dummy',
  KOL_DISPOSABLE_ROOM_A:'11111111-1111-1111-1111-111111111111',
  KOL_DISPOSABLE_ROOM_B:'22222222-2222-2222-2222-222222222222',
  KOL_DISPOSABLE_START_DATE:'2026-12-01',
  KOL_DISPOSABLE_END_DATE:'2026-12-03'
}});
assert.notEqual(hostile.status,0,'Known active project must be blocked');
assert.match(hostile.stderr,/Refusing to test against known active KÖL test project/);
console.log('KÖL disposable concurrency safety guard: PASS');

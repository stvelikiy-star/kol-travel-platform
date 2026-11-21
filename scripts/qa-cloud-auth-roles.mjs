/**
 * One-shot cloud Auth QA. Runs only on the existing isolated KOL test Supabase project.
 * No live business transactions; no tokens, passwords or secret keys in logs.
 * Invoke via the dedicated workflow. Cleanup can be rerun independently.
 */
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const projectRef = 'mphruawzozrpwcjgejhs';
const expectedUrl = 'https://' + projectRef + '.supabase.co';
const expectedBranch = 'refs/heads/release/kol-unified-p0-20261120';
const roles = [
  ['client', 'client'],
  ['partner', 'partner_owner'],
  ['courier', 'courier'],
  ['admin', 'super_admin'],
];
const runId = process.env.GITHUB_RUN_ID;
const attempt = process.env.GITHUB_RUN_ATTEMPT;
const prefix = 'kol-qa-' + runId + '-' + attempt + '-';
const mode = process.argv[2];
const url = process.env.KOL_QA_SUPABASE_URL;
const adminKey = process.env.KOL_QA_SERVICE_ROLE_KEY;
const publishableKey = process.env.KOL_QA_PUBLISHABLE_KEY;
const qaTag = 'kol-cloud-auth-qa-v1';

function invariant(value, reason) {
  if (!value) throw new Error(reason);
}

invariant(mode === '--run' || mode === '--cleanup', 'Invalid QA mode');
invariant(process.env.GITHUB_ACTIONS === 'true', 'GitHub Actions only');
invariant(process.env.GITHUB_REPOSITORY === 'stvelikiy-star/kol-travel-platform', 'Unexpected repository');
invariant(process.env.GITHUB_REF === expectedBranch, 'Unexpected branch');
invariant(/^[0-9]+$/.test(runId || '') && /^[0-9]+$/.test(attempt || ''), 'Missing GitHub run identity');
invariant(url === expectedUrl, 'Refusing to access any other Supabase project');
invariant(adminKey && publishableKey && adminKey !== publishableKey, 'Separate QA admin and publishable keys are required');
invariant(publishableKey.startsWith('sb_publishable_') || publishableKey.startsWith('eyJ'), 'Unexpected public key format');
invariant(adminKey.startsWith('eyJ') || adminKey.startsWith('sb_secret_'), 'Unexpected QA admin key format');

const admin = createClient(url, adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
const created = [];
const sessions = [];
let baseline = null;
let error = null;

async function listUsers() {
  const users = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error: err } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (err) throw new Error('Auth listUsers failed: ' + (err.code || err.status || 'unknown'));
    users.push(...(data?.users || []));
    if ((data?.users?.length || 0) < 100) return users;
  }
  throw new Error('Auth user pagination exceeded safety limit');
}
function isOwnedQA(user) {
  return user.email?.startsWith(prefix) &&
    user.app_metadata?.kol_qa_tag === qaTag &&
    user.app_metadata?.kol_qa_cohort === prefix;
}
async function countTable(table) {
  const { count, error: err } = await admin.from(table).select('id', { count: 'exact', head: true });
  if (err || typeof count !== 'number') throw new Error('Read baseline failed: ' + table);
  return count;
}
async function counts() {
  return {
    auth: (await listUsers()).length,
    profiles: await countTable('user_profiles'),
    roles: await countTable('user_roles'),
    bookings: await countTable('bookings'),
    orders: await countTable('orders'),
  };
}
async function cleanup() {
  // Only delete identities marked with the exact current Actions run+attempt cohort.
  // Never delete pre-existing production users or any other QA run.
  for (const session of sessions) {
    try {
      const { error: err } = await session.auth.signOut({ scope: 'global' });
      if (err) console.error('QA session revoke warning: ' + (err.code || err.status || 'unknown'));
    } catch {
      console.error('QA session revoke warning: exception');
    }
  }
  const existing = (await listUsers()).filter(isOwnedQA);
  const failures = [];
  for (const user of existing) {
    const { error: err } = await admin.auth.admin.deleteUser(user.id);
    if (err) failures.push(err.code || String(err.status || 'unknown'));
  }
  const remaining = (await listUsers()).filter(isOwnedQA);
  invariant(!remaining.length && !failures.length, 'QA cleanup failed; only tagged fixtures can be retried');
  console.log('QA_CLEANUP PASS; remaining tagged users: 0');
}
async function execute() {
  baseline = await counts();
  invariant(!(await listUsers()).some(isOwnedQA), 'Old fixtures from same run exist; cleanup required first');
  const identities = new Map();
  for (const [label, role] of roles) {
    const email = prefix + label + '@kol.test';
    const password = randomBytes(30).toString('base64url') + 'Aa1!';
    const { data, error: userErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      app_metadata: { kol_qa_tag: qaTag, kol_qa_cohort: prefix },
    });
    invariant(data?.user?.id && !userErr, 'Auth createUser failed: ' + label + ':' + (userErr?.code || 'unknown'));
    const uid = data.user.id;
    created.push(uid);
    identities.set(label, { uid, email, password, role });
    const { error: profileErr } = await admin.from('user_profiles').insert({
      user_id: uid, email, full_name: 'Temporary KOL QA ' + label,
      metadata: { kol_qa_tag: qaTag, kol_qa_cohort: prefix },
    });
    invariant(!profileErr, 'Profile fixture failed: ' + label + ':' + (profileErr?.code || 'unknown'));
    const { error: roleErr } = await admin.from('user_roles').insert({
      user_id: uid, role, is_active: true,
    });
    invariant(!roleErr, 'Role fixture failed: ' + label + ':' + (roleErr?.code || 'unknown'));
  }

  for (const [label, { uid, email, password, role }] of identities) {
    // This is a normal public-key Supabase client. Service-role client is NEVER used for RLS tests.
    const client = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: login, error: loginErr } = await client.auth.signInWithPassword({ email, password });
    invariant(!loginErr && login?.session?.access_token, 'Real password login failed: ' + label + ':' + (loginErr?.code || 'no_session'));
    sessions.push(client);
    const { data: verified, error: verifyErr } = await client.auth.getUser(login.session.access_token);
    invariant(!verifyErr && verified?.user?.id === uid, 'Supabase JWT identity mismatch: ' + label);
    const { data: ownRoles, error: roleErr } = await client.from('user_roles').select('user_id,role');
    invariant(!roleErr && ownRoles.length === 1 && ownRoles[0].user_id === uid && ownRoles[0].role === role,
      'Authenticated role read/RLS failed: ' + label);
    const { data: ownProfiles, error: profileErr } = await client.from('user_profiles').select('user_id');
    invariant(!profileErr && ownProfiles.length === 1 && ownProfiles[0].user_id === uid,
      'Authenticated profile read/RLS failed: ' + label);
    const foreign = [...identities.values()].find(identity => identity.uid !== uid);
    const { data: foreignRoles, error: foreignRoleErr } = await client.from('user_roles')
      .select('user_id').eq('user_id', foreign.uid);
    invariant(!foreignRoleErr && foreignRoles.length === 0, 'Other-user role leakage: ' + label);
    const { data: foreignProfiles, error: foreignProfileErr } = await client.from('user_profiles')
      .select('user_id').eq('user_id', foreign.uid);
    invariant(!foreignProfileErr && foreignProfiles.length === 0, 'Other-user profile leakage: ' + label);
    console.log('QA_ROLE PASS ' + label + ': real Supabase login, verified JWT, own-only RLS');
  }
  invariant(created.length === 4, 'Not all four QA identities were created');
}
try {
  if (mode === '--run') await execute();
} catch (err) {
  error = err?.message || 'Unexpected QA error';
  console.error('QA_AUTH FAIL:', error);
} finally {
  try {
    await cleanup();
    if (mode === '--run' && baseline) {
      const after = await counts();
      for (const name of Object.keys(baseline)) {
        if (baseline[name] !== after[name]) throw new Error('Baseline mismatch: ' + name);
      }
      console.log('QA_BASELINE PASS: Auth, roles, profiles, bookings and orders unchanged');
    }
  } catch (err) {
    console.error('QA_CLEANUP FAIL:', err?.message || 'unknown');
    error = error || 'Cleanup or final data reconciliation failed';
  }
}
if (error) process.exitCode = 1;
else console.log(mode === '--run' ? 'QA_AUTH_FINAL PASS: 4/4 real Auth+JWT+RLS with cleanup' : 'QA_AUTH_CLEANUP_FINAL PASS');

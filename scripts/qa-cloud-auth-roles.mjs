/**
 * One-shot cloud Auth QA. Runs only on the existing isolated KOL test Supabase project.
 * No live business transactions; no tokens, passwords or secret keys in logs.
 * Invoke via the dedicated workflow. Cleanup can be rerun independently.
 */
import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const projectRef = 'mphruawzozrpwcjgejhs';
const expectedUrl = 'https://' + projectRef + '.supabase.co';
const allowedBranches = new Set(['refs/heads/release/kol-unified-p0-20261120', 'refs/heads/feat/kol-content-visual-editor-20261123', 'refs/heads/feat/kol-superadmin-user-access-20261124']);
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
const receiptPath = join(process.env.RUNNER_TEMP || '/tmp', 'kol-cloud-qa-' + runId + '-' + attempt + '.ids');

function invariant(value, reason) {
  if (!value) throw new Error(reason);
}

invariant(mode === '--run' || mode === '--cleanup', 'Invalid QA mode');
invariant(process.env.GITHUB_ACTIONS === 'true', 'GitHub Actions only');
invariant(process.env.GITHUB_REPOSITORY === 'stvelikiy-star/kol-travel-platform', 'Unexpected repository');
invariant(allowedBranches.has(process.env.GITHUB_REF), 'Unexpected branch');
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

// Auth listUsers currently returns HTTP 500 on legacy NULL token fields.
// Current-run identities are tracked locally and in the scoped public profile rows.
function recordOwnedId(id) {
  invariant(/^[a-f0-9-]{36}$/i.test(id), 'Invalid fixture ID');
  appendFileSync(receiptPath, id + '\n', { encoding: 'utf8', mode: 0o600 });
}
function recordedIds() {
  if (!existsSync(receiptPath)) return [];
  return readFileSync(receiptPath, 'utf8').split(/\r?\n/).filter(Boolean);
}
async function scopedProfiles() {
  const { data, error: err } = await admin.from('user_profiles')
    .select('user_id,email,metadata').like('email', prefix + '%');
  if (err) throw new Error('QA profile lookup failed: ' + (err.code || 'unknown'));
  return (data || []).filter(row =>
    row.email?.startsWith(prefix) &&
    row.metadata?.kol_qa_tag === qaTag &&
    row.metadata?.kol_qa_cohort === prefix);
}
function isOwnedQA(user) {
  return user?.email?.startsWith(prefix) &&
    user?.app_metadata?.kol_qa_tag === qaTag &&
    user?.app_metadata?.kol_qa_cohort === prefix;
}
async function scopedUser(id) {
  const { data, error: err } = await admin.auth.admin.getUserById(id);
  if (err?.status === 404 || err?.code === 'user_not_found') return null;
  if (err) throw new Error('QA scoped Auth lookup failed: ' + (err.code || err.status || 'unknown'));
  invariant(isOwnedQA(data?.user), 'Refusing to delete an account without exact QA marker');
  return data.user;
}
async function countTable(table) {
  const { count, error: err } = await admin.from(table).select('id', { count: 'exact', head: true });
  if (err || typeof count !== 'number') throw new Error('Read baseline failed: ' + table);
  return count;
}
async function counts() {
  return {
    profiles: await countTable('user_profiles'),
    roles: await countTable('user_roles'),
    bookings: await countTable('bookings'),
    orders: await countTable('orders'),
  };
}
async function cleanup() {
  for (const session of sessions) {
    try {
      const { error: err } = await session.auth.signOut({ scope: 'global' });
      if (err) console.error('QA session revoke warning: ' + (err.code || err.status || 'unknown'));
    } catch {
      console.error('QA session revoke warning: exception');
    }
  }
  const profiles = await scopedProfiles();
  const ids = new Set([...created, ...recordedIds(), ...profiles.map(row => row.user_id)]);
  const failures = [];
  for (const id of ids) {
    try {
      const user = await scopedUser(id);
      if (!user) continue;
      const { error: err } = await admin.auth.admin.deleteUser(id);
      if (err) throw new Error(err.code || String(err.status || 'unknown'));
      invariant(await scopedUser(id) === null, 'Deleted user is still present');
    } catch (err) {
      failures.push(String(err?.message || 'cleanup_failure').slice(0,120));
    }
  }
  const remainingProfiles = await scopedProfiles();
  invariant(!remainingProfiles.length && !failures.length,
    'QA cleanup failed: ' + (failures.join(', ') || 'scoped profiles remain'));
  if (existsSync(receiptPath)) unlinkSync(receiptPath);
  console.log('QA_CLEANUP PASS: ' + ids.size + ' scoped account IDs reconciled');
}
async function execute() {
  baseline = await counts();
  invariant(!(await scopedProfiles()).length && !recordedIds().length,
    'Old fixtures from same run exist; cleanup required first');
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
    recordOwnedId(uid);
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

  // Negative JWT/RLS checks against the same QA Supabase project; never expose server secrets.
  const anon=createClient(url,publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  for(const table of ['user_profiles','user_roles','support_tickets','orders','bookings']){
    const {data:anonRows,error:anonError}=await anon.from(table).select('id').limit(1);
    invariant(!!anonError || (Array.isArray(anonRows) && anonRows.length===0),
      'Anonymous private data access: '+table);
  }
  console.log('QA_SECURITY PASS: anonymous access to private records denied');

  for (const [label, { uid, email, password, role }] of identities) {
    // This is a normal public-key Supabase client. Service-role client is NEVER used for RLS tests.
    const client = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: login, error: loginErr } = await client.auth.signInWithPassword({ email, password });
    invariant(!loginErr && login?.session?.access_token, 'Real password login failed: ' + label + ':' + (loginErr?.code || 'no_session'));
    sessions.push(client);
    const rawJWT=login.session.access_token;
    const parts=rawJWT.split('.');
    invariant(parts.length===3 && parts[2].length>8,'Unexpected JWT format: '+label);
    // Tamper with signature: the signed identity must not verify.
    const tampered=parts[0]+'.'+parts[1]+'.'+(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);
    const {data:forged,error:forgedError}=await client.auth.getUser(tampered);
    invariant(!!forgedError && !forged?.user,'Forged JWT accepted: '+label);
    console.log('QA_SECURITY PASS: forged JWT rejected for '+label);
    const { data: verified, error: verifyErr } = await client.auth.getUser(rawJWT);
    invariant(!verifyErr && verified?.user?.id === uid, 'Supabase JWT identity mismatch: ' + label);
    const { data: ownRoles, error: roleErr } = await client.from('user_roles').select('user_id,role');
    invariant(!roleErr && ownRoles.length === 1 && ownRoles[0].user_id === uid && ownRoles[0].role === role,
      'Authenticated role read/RLS failed: ' + label);
    const { data: ownProfiles, error: profileErr } = await client.from('user_profiles').select('user_id');
    // The project's RLS deliberately grants admin roles cross-user profile read.
    // CLIENT, PARTNER and COURIER must remain limited to their own profile.
    invariant(!profileErr && (label === 'admin'
      ? ownProfiles.some(row => row.user_id === uid)
      : ownProfiles.length === 1 && ownProfiles[0].user_id === uid),
      'Authenticated profile read/RLS failed: ' + label);
    const foreign = [...identities.values()].find(identity => identity.uid !== uid);
    const { data: foreignRoles, error: foreignRoleErr } = await client.from('user_roles')
      .select('user_id').eq('user_id', foreign.uid);
    invariant(!foreignRoleErr && foreignRoles.length === 0, 'Other-user role leakage: ' + label);
    const { data: foreignProfiles, error: foreignProfileErr } = await client.from('user_profiles')
      .select('user_id').eq('user_id', foreign.uid);
    invariant(!foreignProfileErr && (label === 'admin'
      ? foreignProfiles.length === 1 && foreignProfiles[0].user_id === foreign.uid
      : foreignProfiles.length === 0),
      'Role-based profile visibility failed: ' + label);
    console.log('QA_ROLE PASS ' + label + ': real Supabase login, verified JWT, role-appropriate RLS');
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
      console.log('QA_BASELINE PASS: roles, profiles, bookings and orders unchanged; Auth count requires independent SQL verification');
    }
  } catch (err) {
    console.error('QA_CLEANUP FAIL:', err?.message || 'unknown');
    error = error || 'Cleanup or final data reconciliation failed';
  }
}
if (error) process.exitCode = 1;
else console.log(mode === '--run' ? 'QA_AUTH_FINAL PASS: 4/4 real Auth+JWT+RLS with cleanup' : 'QA_AUTH_CLEANUP_FINAL PASS');

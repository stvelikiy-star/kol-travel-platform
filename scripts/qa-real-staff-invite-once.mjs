/**
 * One-time real external KÖL QA staff invitation.
 * Runs only on the owner-created, same-repository PR #182, never on Production.
 * Re-runs verify the existing scoped invitation rather than sending a duplicate.
 */
import { createClient } from '@supabase/supabase-js';
import { isTrustedKolQaTrigger } from './qa-trusted-trigger.mjs';

const project = 'mphruawzozrpwcjgejhs';
const email = 'hr.vgroup.kg@gmail.com';
const marker = 'kol-pr182-qa-invite-20261125';
const branch = 'release/kol-unified-qa-candidate-20261125';
const origin = 'https://kol-launch-staging-20260925-git-release-kol-u-86ce32-ai-prof-kg.vercel.app';
const redirectTo = origin + '/auth/invite?next=%2Feditor%2Fcontent';

function requireQA(ok, reason) {
  if (!ok) throw new Error(reason);
}
requireQA(process.env.GITHUB_ACTIONS === 'true', 'GITHUB_ACTIONS required');
requireQA(process.env.GITHUB_REPOSITORY === 'stvelikiy-star/kol-travel-platform', 'Wrong repository');
requireQA(process.env.GITHUB_EVENT_NAME === 'pull_request', 'PR event required');
requireQA(process.env.GITHUB_HEAD_REF === branch, 'Wrong QA branch');
requireQA(process.env.GITHUB_ACTOR === 'stvelikiy-star', 'Wrong initiating actor');
requireQA(isTrustedKolQaTrigger(process.env), 'Untrusted QA event');
requireQA(process.env.KOL_QA_SUPABASE_URL === 'https://' + project + '.supabase.co', 'Wrong Supabase target');
const key = process.env.KOL_QA_SERVICE_ROLE_KEY;
requireQA(!!key && (key.startsWith('eyJ') || key.startsWith('sb_secret_')), 'No QA admin credentials');
const admin = createClient(process.env.KOL_QA_SUPABASE_URL, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});
function check(err, context) {
  if (err) throw new Error(context + ': ' + (err.code || err.status || 'unknown'));
}
const { data: preexisting, error: profileReadError } = await admin
  .from('user_profiles').select('user_id,email,metadata').eq('email', email);
check(profileReadError, 'QA preflight profile query failed');
requireQA(preexisting.length <= 1, 'Duplicate QA email profile: refused');
if (preexisting.length === 1) {
  const p = preexisting[0];
  requireQA(p.metadata?.kol_qa_invite_marker === marker, 'Email belongs to a non-QA identity');
  const { data: rr, error: roleError } = await admin
    .from('user_roles').select('role,is_active').eq('user_id', p.user_id);
  check(roleError, 'QA existing role lookup failed');
  requireQA(rr.length === 1 && rr[0].role === 'content_manager',
    'Existing invited role unexpected');
  const {data: au, error: authError} = await admin.auth.admin.getUserById(p.user_id);
  check(authError, 'QA existing user lookup failed');
  requireQA(au.user?.email === email, 'QA existing Auth user mismatch');
  console.log('KOL_QA_REAL_INVITE_EXISTING_PASS: approved QA identity exists; no duplicate email sent');
} else {
  const { data: users, error: listError } = await admin.auth.admin.listUsers({ page:1, perPage:1000 });
  check(listError, 'QA Auth preflight list failed');
  requireQA(!(users.users || []).some(u => u.email?.toLowerCase() === email),
    'Email already has an Auth account without a provisioned QA profile');
  const {data: invitation, error: inviteError} =
    await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { full_name: 'KÖL QA staff invitation' }
    });
  check(inviteError, 'QA SMTP invitation not accepted');
  const id=invitation?.user?.id;
  requireQA(!!id && invitation.user.email?.toLowerCase() === email,
    'QA Auth invite returned unexpected identity');
  let provisionOK=false;
  try {
    const {error: profileError}=await admin.from('user_profiles').insert({
      user_id:id, email, full_name:'KÖL QA staff invitation', status:'active',
      metadata: {kol_qa_invite_marker:marker}
    });
    check(profileError, 'QA invited profile setup failed');
    const {error: roleError}=await admin.from('user_roles').insert({
      user_id:id, role:'content_manager', is_active:true
    });
    check(roleError, 'QA invited role setup failed');
    const {error: adminError}=await admin.from('admin_profiles').insert({
      user_id:id, admin_level:'content_manager', department:'QA staff invitation'
    });
    check(adminError,'QA invited editor profile setup failed');
    provisionOK=true;
  } finally {
    if (!provisionOK) {
      const {error:blockError}=await admin.from('user_profiles').update({status:'blocked'}).eq('user_id',id);
      if (blockError) console.error('QA_INVITE_BLOCK_FAILURE');
      const {error:roleBlockError}=await admin.from('user_roles').update({is_active:false}).eq('user_id',id);
      if(roleBlockError) console.error('QA_INVITE_ROLE_BLOCK_FAILURE');
      console.error('QA invitation may have been dispatched, but provisioning failed: account blocked');
    }
  }
  const { data: au, error: authError } = await admin.auth.admin.getUserById(id);
  check(authError,'QA post-invite Auth lookup failed');
  requireQA(au.user?.email === email, 'QA post-invite identity mismatch');
  console.log('KOL_QA_REAL_INVITE_SENT_PASS: Auth invite API accepted external email; staff account and limited content_manager scope provisioned');
  console.log('KOL_QA_INVITE_DELIVERY_UNVERIFIED: inbox receipt, clicking link and password setup require user-side confirmation');
}

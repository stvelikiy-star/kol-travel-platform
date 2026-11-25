import { createClient } from '@supabase/supabase-js';
import { isTrustedKolQaTrigger } from './qa-trusted-trigger.mjs';

const url='https://mphruawzozrpwcjgejhs.supabase.co';
const inviteEmail='hr.vgroup.kg@gmail.com';
const marker='kol-pr182-qa-invite-20261125';
if (process.env.GITHUB_ACTIONS!=='true' ||
    process.env.GITHUB_REPOSITORY!=='stvelikiy-star/kol-travel-platform' ||
    !isTrustedKolQaTrigger(process.env) ||
    process.env.KOL_QA_SUPABASE_URL!==url ||
    !process.env.KOL_QA_SERVICE_ROLE_KEY)
  throw Error('QA_AUTH_ADMIN_LIST prerequisites missing');
const admin=createClient(url,process.env.KOL_QA_SERVICE_ROLE_KEY,
  {auth:{persistSession:false,autoRefreshToken:false}});
const {data,error}=await admin.auth.admin.listUsers({page:1,perPage:100});
if(error) throw Error('QA_AUTH_ADMIN_LIST FAIL: '+(error.code||error.status||'auth_admin_failed'));
if(!Array.isArray(data?.users))throw Error('QA_AUTH_ADMIN_LIST FAIL: no Auth users');
const invitations=data.users.filter(u=>u.email?.toLowerCase()===inviteEmail);
const baseline=data.users.filter(u=>u.email?.toLowerCase()!==inviteEmail);
if(baseline.length!==5 || invitations.length>1 ||
   data.users.some(x=>x.email?.startsWith('kol-e2e-')||x.email?.startsWith('kol-qa-')))
   throw Error('QA_AUTH_ADMIN_LIST FAIL: unexpected unowned baseline');
if(invitations.length===1){
  const person=invitations[0];
  const {data:profile,error:profileError}=await admin.from('user_profiles')
    .select('user_id,metadata,status').eq('user_id',person.id).maybeSingle();
  const {data:roles,error:rolesError}=await admin.from('user_roles')
    .select('user_id,role,is_active').eq('user_id',person.id);
  if(profileError||rolesError||profile?.metadata?.kol_qa_invite_marker!==marker ||
    profile.status!=='active' || roles?.length!==1 ||
    roles[0].role!=='content_manager' || !roles[0].is_active)
      throw Error('QA_AUTH_ADMIN_LIST FAIL: invitation identity not explicitly owned and scoped');
}
console.log('QA_AUTH_ADMIN_LIST PASS: 5 baseline accounts, '+invitations.length+
  ' uniquely owned staff invite, no transient QA fixtures');

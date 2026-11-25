import { createClient } from '@supabase/supabase-js';
import { isTrustedKolQaTrigger } from './qa-trusted-trigger.mjs';
const url='https://mphruawzozrpwcjgejhs.supabase.co';
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
if(!Array.isArray(data?.users)||data.users.length!==5 ||
   data.users.some(x=>x.email?.startsWith('kol-e2e-')||x.email?.startsWith('kol-qa-')))
   throw Error('QA_AUTH_ADMIN_LIST FAIL: unexpected baseline');
console.log('QA_AUTH_ADMIN_LIST PASS: five readable Auth accounts, no QA fixtures');

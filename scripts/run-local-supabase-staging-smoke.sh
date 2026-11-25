#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DB_URL="${SUPABASE_LOCAL_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
MANIFEST="supabase/staging/migration-plan.json"

psql_file() {
  local label="$1"
  local file="$2"
  echo "::group::${label}: ${file}"
  psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f "$file"
  echo "::endgroup::"
}

cleanup() {
  supabase stop --no-backup >/dev/null 2>&1 || true
}
trap cleanup EXIT

# config.toml has seed enabled; the recovered repository intentionally has no canonical seed.sql.
# Keep local startup deterministic without committing or applying a hidden seed.
touch supabase/seed.sql

# Local-only stack. Keep Auth + Storage + PostgREST because the staging package relies on them.
# Exclude UI/analytics/realtime/functions services that are not needed for this DB transaction smoke.
bash scripts/start-local-supabase-with-retry.sh

# Capture local credentials without echoing secret values to the Actions log.
supabase status -o env > /tmp/kol-supabase-local.env
set -a
# shellcheck disable=SC1091
source /tmp/kol-supabase-local.env
set +a

export SUPABASE_URL="${API_URL:-http://127.0.0.1:54321}"
export NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL"
export SUPABASE_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:?local Supabase SERVICE_ROLE_KEY missing}"
# Disposable local QA needs a dedicated random HMAC key. Never reuse service-role.
# Intentionally not exported to any cloud, Production database or deployment.
if [[ -z "${KOL_INTAKE_IP_HMAC_KEY:-}" ]]; then
  command -v openssl >/dev/null 2>&1 || { echo "Local QA needs openssl to generate independent HMAC key." >&2; exit 1; }
  export KOL_INTAKE_IP_HMAC_KEY="$(openssl rand -hex 32)"
fi
if [[ "$KOL_INTAKE_IP_HMAC_KEY" == "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
  echo "Local QA refuses to reuse Supabase service-role credential as intake HMAC." >&2
  exit 1
fi
export SUPABASE_ANON_KEY="${ANON_KEY:-${PUBLISHABLE_KEY:-}}"
if [[ -z "$SUPABASE_ANON_KEY" ]]; then
  echo "Local Supabase anon/publishable key missing from Supabase CLI status." >&2
  exit 1
fi
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
export KOL_DEPLOYMENT_ENV="staging"

psql_file "Recovered baseline schema" "supabase/schema/001_initial_schema.sql"
psql_file "Recovered baseline RLS" "supabase/schema/002_rls_policies_draft.sql"
psql_file "Recovered demo seed" "supabase/schema/003_seed_demo_data_draft_FIXED.sql"
psql_file "Staging preflight" "supabase/staging/000_preflight_read_only.sql"

mapfile -t migration_rows < <(
  node --input-type=module - "$MANIFEST" <<'NODE'
import fs from 'node:fs';
const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const migration of manifest.migrations) {
  const verifies = Array.isArray(migration.verify) ? migration.verify.join('|') : '';
  process.stdout.write(`${migration.id}\t${migration.apply}\t${verifies}\n`);
}
NODE
)

for row in "${migration_rows[@]}"; do
  IFS=$'\t' read -r id apply_file verify_joined <<< "$row"

  if [[ "$id" == "009" ]]; then
    echo "::group::009 pre-action: provision private catalog-media bucket via Storage API"
    npm run provision:catalog-media-bucket
    npm run check:catalog-media-bucket
    echo "::endgroup::"
  fi

  psql_file "${id} APPLY" "$apply_file"

  IFS='|' read -ra verify_files <<< "$verify_joined"
  for verify_file in "${verify_files[@]}"; do
    [[ -n "$verify_file" ]] || continue
    psql_file "${id} VERIFY" "$verify_file"
  done
done

psql_file "Staging postflight" "supabase/staging/999_postflight_read_only.sql"
psql_file "Disposable role isolation and write denial" "supabase/staging/restored_role_isolation_TEST.sql"

# Machine assertions that must be zero/true; unlike the human-readable VERIFY files,
# these make CI fail when core staging invariants are violated.
psql "$DB_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  v_helper_count integer;
  v_bad_search_path integer;
  v_policyless integer;
  v_direct_dml integer;
  v_missing_fk integer;
  v_missing_fk_details text;
  v_rpc_count integer;
  v_payment_privilege_mismatch integer;
  v_stage21 integer;
  v_delivery_mismatch integer;
BEGIN
  SELECT count(*) INTO v_helper_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('set_updated_at','has_role','is_admin','is_finance_admin','is_partner_for','is_assigned_courier');
  IF v_helper_count <> 6 THEN
    RAISE EXCEPTION 'local_smoke_helper_function_count_failed: expected 6, got %', v_helper_count;
  END IF;

  SELECT count(*) INTO v_bad_search_path
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('set_updated_at','has_role','is_admin','is_finance_admin','is_partner_for','is_assigned_courier')
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(coalesce(p.proconfig, '{}'::text[])) cfg
      WHERE cfg LIKE 'search_path=%'
    );
  IF v_bad_search_path <> 0 THEN
    RAISE EXCEPTION 'local_smoke_search_path_invariant_failed: % functions', v_bad_search_path;
  END IF;

  SELECT count(*) INTO v_policyless
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relrowsecurity
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = c.relname
    );
  IF v_policyless <> 0 THEN
    RAISE EXCEPTION 'local_smoke_policyless_rls_tables_failed: % tables', v_policyless;
  END IF;

  SELECT count(*) INTO v_direct_dml
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND grantee IN ('anon','authenticated')
    AND privilege_type IN ('INSERT','UPDATE','DELETE')
    AND table_name IN (
      'bookings','booking_status_history','orders','order_items','order_status_history',
      'payments','order_payments','deliveries','order_delivery','courier_assignments','delivery_status_history','audit_logs'
    );
  IF v_direct_dml <> 0 THEN
    RAISE EXCEPTION 'local_smoke_transactional_direct_dml_failed: % grants', v_direct_dml;
  END IF;

  WITH fk AS (
    SELECT con.conname, con.conrelid, con.conkey[1] AS attnum
    FROM pg_constraint con
    WHERE con.connamespace = 'public'::regnamespace
      AND con.contype = 'f'
      AND cardinality(con.conkey) = 1
  ), missing AS (
    SELECT fk.*
    FROM fk
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_index i
      WHERE i.indrelid = fk.conrelid
        AND i.indisvalid
        AND i.indisready
        AND i.indkey[0] = fk.attnum
    )
  )
  SELECT count(*), string_agg(
    format('%s.%I [%s]', m.conrelid::regclass, a.attname, m.conname),
    ', ' ORDER BY m.conrelid::regclass::text, a.attname
  ) INTO v_missing_fk, v_missing_fk_details
  FROM missing m
  JOIN pg_attribute a ON a.attrelid = m.conrelid AND a.attnum = m.attnum;
  IF v_missing_fk <> 0 THEN
    RAISE EXCEPTION 'local_smoke_missing_fk_indexes_failed: % foreign keys: %', v_missing_fk, v_missing_fk_details;
  END IF;

  SELECT count(DISTINCT p.proname) INTO v_rpc_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'create_stay_booking_atomic','create_tour_booking_atomic',
      'create_order_atomic','mark_order_ready_for_pickup_atomic',
      'create_payment_attempt_atomic','apply_verified_payment_event_atomic',
      'assign_courier_atomic','courier_transition_delivery_atomic',
      'partner_booking_action_atomic'
    );
  IF v_rpc_count <> 9 THEN
    RAISE EXCEPTION 'local_smoke_required_rpc_count_failed: expected 9, got %', v_rpc_count;
  END IF;

  SELECT count(*) INTO v_payment_privilege_mismatch
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('create_payment_attempt_atomic','apply_verified_payment_event_atomic')
    AND (
      has_function_privilege('anon', p.oid, 'EXECUTE')
      OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
      OR NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
    );
  IF v_payment_privilege_mismatch <> 0 THEN
    RAISE EXCEPTION 'local_smoke_payment_rpc_privilege_failed: % functions', v_payment_privilege_mismatch;
  END IF;

  SELECT count(*) INTO v_stage21
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (table_name, column_name) IN (
      ('menu_items','slug'), ('products','slug'), ('tours','image_url'), ('stays','capacity')
    );
  IF v_stage21 <> 0 THEN
    RAISE EXCEPTION 'local_smoke_stage21_must_remain_absent: % columns', v_stage21;
  END IF;

  SELECT count(*) INTO v_delivery_mismatch
  FROM public.deliveries d
  LEFT JOIN public.courier_assignments ca
    ON ca.delivery_id = d.id
   AND ca.status IN ('assigned','accepted','in_progress')
  WHERE d.status NOT IN ('delivered','delivery_failed')
    AND d.assigned_courier_id IS NOT NULL
    AND (ca.id IS NULL OR ca.courier_id IS DISTINCT FROM d.assigned_courier_id);
  IF v_delivery_mismatch <> 0 THEN
    RAISE EXCEPTION 'local_smoke_delivery_assignment_invariant_failed: % rows', v_delivery_mismatch;
  END IF;
END
$$;
SQL

node --input-type=module <<'NODE'
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('local Storage smoke credentials are missing');

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});
const { data, error } = await supabase.storage.listBuckets();
if (error) throw error;
const bucket = data.find((item) => item.id === 'catalog-media');
if (!bucket || bucket.public !== false) throw new Error('catalog-media private bucket invariant failed');
console.log('Local Storage API invariant: PASS');
NODE

# Draft 033 is exercised ONLY inside this disposable CI/local Supabase instance.
psql_file "033 disposable atomic public intake APPLY" "supabase/schema/033_public_intake_atomic_rate_limit_DRAFT_NOT_APPLIED.sql"
psql_file "033 disposable atomic public intake VERIFY" "supabase/schema/033_public_intake_atomic_rate_limit_VERIFY.sql"
# The local PostgREST process may have cached its RPC schema before draft 033 was installed.
# Explicitly reload the disposable instance; do not touch any remote schema cache.
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -c "NOTIFY pgrst, 'reload schema'"
KOL_DISPOSABLE_DB_URL="$DB_URL" KOL_CONFIRMED_EPHEMERAL_DB=true \
  node scripts/qa-local-public-intake-atomic.mjs

echo "::group::Public Supabase runtime smoke"
bash scripts/run-local-supabase-public-runtime-smoke.sh
echo "::endgroup::"

echo "::group::Transactional behavior tests"
bash scripts/run-local-supabase-transaction-tests.sh "$DB_URL"
echo "::endgroup::"

# Finance migrations are validated only against this disposable local Supabase.
# The live/cloud database is never used here. Order is significant.
echo "::group::Isolated finance SQL and actual RPC transaction smoke"
psql_file "Finance agreement and settlement preview" "ops/release-sql/kol-finance-contract-settlement-preview-v1-20261121.sql"
psql_file "Finance double-entry recognition ledger" "ops/release-sql/kol-double-entry-recognition-ledger-20261121.sql"
psql_file "Finance refund/payout request and decisions" "ops/release-sql/kol-finance-request-approval-workflow-20261121.sql"
psql_file "Finance OWNER cost accrual and reversal" "ops/release-sql/kol-owner-cost-accrual-reversal-v1-20261121.sql"
psql_file "Finance read-only analytics" "ops/release-sql/kol-finance-analytics-read-v1-20261121.sql"

# The historical disposable staging package predates hosted grants on Auth
# profile/role lookup tables. Align only this ephemeral local fixture with the
# verified hosted service_role SELECT privileges; never change the cloud RLS.
psql "$DB_URL" -X -v ON_ERROR_STOP=1 <<'KOL_FINANCE_LOCAL_GRANTS'
GRANT SELECT ON public.user_roles,public.user_profiles,public.partner_profiles,
  public.rooms,public.stays,public.tours,public.partners,
  public.payments,public.orders,public.bookings,public.refunds,
  public.audit_logs TO service_role;
GRANT INSERT ON public.audit_logs TO service_role;
GRANT SELECT ON private.payment_provider_events TO service_role;
KOL_FINANCE_LOCAL_GRANTS

# All additional finance test writes are rolled back even inside the ephemeral DB.
# The existing local paid provider fixture is made by run-local-supabase-transaction-tests.sh.
psql "$DB_URL" -X -v ON_ERROR_STOP=1 <<'KOL_FINANCE_SQL'
BEGIN;
SET LOCAL ROLE service_role;
DO $qa$
DECLARE
  v_owner uuid := '00000000-0000-0000-0000-000000000001';
  v_client uuid := '00000000-0000-0000-0000-000000000002';
  v_payment uuid;
  v_expense jsonb;
  v_duplicate jsonb;
  v_reversal jsonb;
  v_refund jsonb;
  v_decision jsonb;
  v_expense_id uuid;
  v_reversal_id uuid;
  v_request_id uuid;
  v_report jsonb;
BEGIN
  IF has_function_privilege('anon','public.kol_post_finance_cost_v1(text,numeric,text,text,uuid,text,uuid,text,text,uuid)','EXECUTE')
     OR has_function_privilege('authenticated','public.kol_create_finance_request_v1(text,uuid,numeric,uuid,text,text)','EXECUTE')
     OR has_function_privilege('anon','public.kol_decide_finance_request_v1(uuid,text,uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'finance_privileged_rpc_public_access';
  END IF;

  SELECT p.id INTO v_payment
    FROM public.payments p
    WHERE p.provider='local-test' AND p.provider_reference='provider-ref-0001' AND p.status='paid'
    LIMIT 1;
  IF v_payment IS NULL THEN RAISE EXCEPTION 'finance_paid_provider_fixture_missing'; END IF;

  v_expense := public.kol_post_finance_cost_v1(
    'expense',123.45,'KGS','operations',NULL,
    'QA_FINANCE_DOCUMENT_20261121',v_owner,'QA_OWNER_APPROVAL_20261121',
    'qa-finance-cost-expense-20261121',NULL);
  v_expense_id := (v_expense->>'journal_id')::uuid;
  IF v_expense->>'ok'<>'true' OR v_expense->>'duplicate'<>'false' OR v_expense_id IS NULL THEN
    RAISE EXCEPTION 'finance_expense_post_failed';
  END IF;
  v_duplicate := public.kol_post_finance_cost_v1(
    'expense',123.45,'KGS','operations',NULL,
    'QA_FINANCE_DOCUMENT_20261121',v_owner,'QA_OWNER_APPROVAL_20261121',
    'qa-finance-cost-expense-20261121',NULL);
  IF v_duplicate->>'duplicate'<>'true' OR (v_duplicate->>'journal_id')::uuid <> v_expense_id THEN
    RAISE EXCEPTION 'finance_expense_idempotency_failed';
  END IF;

  v_reversal := public.kol_post_finance_cost_v1(
    'reversal',123.45,'KGS','operations',NULL,
    'QA_FINANCE_REVERSAL_20261121',v_owner,'QA_REVERSAL_APPROVAL_20261121',
    'qa-finance-cost-reversal-20261121',v_expense_id);
  v_reversal_id := (v_reversal->>'journal_id')::uuid;
  IF v_reversal->>'ok'<>'true' OR v_reversal_id IS NULL
     OR (SELECT count(*) FROM public.kol_finance_cost_entries_v1
         WHERE cost_journal_id IN (v_expense_id,v_reversal_id))<>4 THEN
    RAISE EXCEPTION 'finance_reversal_post_failed';
  END IF;
  IF (SELECT coalesce(sum(CASE WHEN entry_side='debit' THEN amount ELSE -amount END),0)
      FROM public.kol_finance_cost_entries_v1
      WHERE cost_journal_id IN (v_expense_id,v_reversal_id)
        AND ledger_account='operating_expense')<>0 THEN
    RAISE EXCEPTION 'finance_expense_reversal_net_mismatch';
  END IF;

  v_refund := public.kol_create_finance_request_v1(
    'refund',v_payment,100,v_client,
    'qa-refund-request-20261121',
    'QA verified provider refund request, no bank transfer');
  v_request_id := (v_refund->>'request_id')::uuid;
  IF v_refund->>'ok'<>'true' OR v_refund->>'duplicate'<>'false'
     OR v_request_id IS NULL THEN RAISE EXCEPTION 'finance_refund_request_failed'; END IF;
  v_duplicate := public.kol_create_finance_request_v1(
    'refund',v_payment,100,v_client,
    'qa-refund-request-20261121',
    'QA verified provider refund request, no bank transfer');
  IF v_duplicate->>'duplicate'<>'true' OR (v_duplicate->>'request_id')::uuid<>v_request_id THEN
    RAISE EXCEPTION 'finance_refund_idempotency_failed';
  END IF;
  v_decision := public.kol_decide_finance_request_v1(
    v_request_id,'approved',v_owner,'QA_INDEPENDENT_OWNER_20261121');
  IF v_decision->>'ok'<>'true' OR v_decision->>'money_transferred'<>'false'
     OR (SELECT count(*) FROM public.refunds WHERE payment_id=v_payment)<>0
     OR (SELECT status FROM public.payments WHERE id=v_payment)<>'paid' THEN
    RAISE EXCEPTION 'finance_decision_claims_bank_transfer';
  END IF;
  v_duplicate := public.kol_decide_finance_request_v1(
    v_request_id,'approved',v_owner,'QA_INDEPENDENT_OWNER_20261121');
  IF v_duplicate->>'duplicate'<>'true' THEN
    RAISE EXCEPTION 'finance_decision_idempotency_failed';
  END IF;

  v_report := public.kol_finance_cost_report_v1(current_date,current_date+1,NULL);
  IF v_report->>'net_profit' IS NOT NULL THEN
    RAISE EXCEPTION 'finance_unverified_net_profit_must_be_null';
  END IF;
  RAISE NOTICE 'KOL_DISPOSABLE_FINANCE_EXPENSE_REVERSAL_REQUEST_APPROVAL_PASS';
END;
$qa$;
ROLLBACK;
SELECT 'KOL_DISPOSABLE_FINANCE_RUNTIME_PASS' AS result;
KOL_FINANCE_SQL
echo "::endgroup::"

# Exercise a real SMTP outage only on the disposable GitHub-hosted local stack.
# Never stop an SMTP service on a user's machine or a hosted Supabase project.
if [[ "${GITHUB_ACTIONS:-}" == "true" && "${RUNNER_ENVIRONMENT:-}" == "github-hosted" && "${GITHUB_REPOSITORY:-}" == "stvelikiy-star/kol-travel-platform" ]]; then
  KOL_SMTP_TEST_DB_URL="$DB_URL" node --input-type=module <<'KOL_SMTP_FAULT'
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {setTimeout as pause} from 'node:timers/promises';
import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
const url=process.env.SUPABASE_URL;
const dbUrl=process.env.KOL_SMTP_TEST_DB_URL;
assert.ok(['http://127.0.0.1:54321','http://localhost:54321'].includes(url),'refuse nonlocal Auth');
const db=new URL(dbUrl);
assert.ok(db.protocol==='postgresql:' && ['127.0.0.1','localhost'].includes(db.hostname) &&
  db.port==='54322' && db.pathname==='/postgres' && !db.search && !db.hash,
  'refuse nonlocal database');
assert.ok(process.env.SUPABASE_SERVICE_ROLE_KEY,'local service key required');
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(45000)})}
});
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',timeout:20000}).trim();
const containers=docker('ps','--format','{{.Names}}|{{.Image}}').split('\n')
  .map(s=>s.split('|')).filter(([name,image])=>name.endsWith('_kol-travel-platform') && /\/mailpit:/.test(image));
assert.equal(containers.length,1,'expected one isolated Mailpit container');
const smtp=containers[0][0];
// Reserved example domain; local Mailpit only, no external email delivery.
const email='kol-smtp-fault-'+randomUUID()+'@example.com';
const marker=randomUUID();
const mailUrl='http://127.0.0.1:54324/api/v1/messages';
let stopped=false;
let uid=null;
let failure=null;
let cleanupFailure=null;
async function waitMailpit(){
  for(let i=0;i<40;i++){
    try{const r=await fetch(mailUrl,{signal:AbortSignal.timeout(2000)});if(r.ok)return;}catch{}
    await pause(500);
  }
  throw Error('local Mailpit did not recover');
}
function findIdentity(){
  // Legacy SQL-seeded users can make Auth listUsers fail for the entire
  // directory. Read only our unique fixture from the disposable local DB.
  const query="SELECT COALESCE(json_agg(json_build_object('id',u.id,'owned',COALESCE(u.raw_user_meta_data->>'kol_smtp_fixture'=:'marker',false),'roles',(SELECT count(*) FROM public.user_roles r WHERE r.user_id=u.id),'profiles',(SELECT count(*) FROM public.user_profiles p WHERE p.user_id=u.id))),'[]'::json)::text FROM auth.users u WHERE lower(u.email)=:'email';";
  let rows;
  try{
    rows=JSON.parse(execFileSync('psql',['-X','-qAt','-v','ON_ERROR_STOP=1','-v','email='+email,'-v','marker='+marker,'-d',dbUrl],
      {input:query+'\n',encoding:'utf8',timeout:15000,stdio:['pipe','pipe','pipe']}).trim());
  }catch{throw Error('local targeted fixture SQL lookup failed');}
  assert.ok(Array.isArray(rows) && rows.length<=1,'duplicate local identity');
  return rows[0];
}
async function removeOwned(user){
  assert.equal(user.owned,true,'refuse unowned identity cleanup');
  assert.equal(user.roles,0,'refuse cleanup with app roles');
  assert.equal(user.profiles,0,'refuse cleanup with app profile');
  const {error}=await admin.auth.admin.deleteUser(user.id);
  assert.ok(!error,'local fixture cleanup failed');
}
function diagnostic(error){
  return JSON.stringify({code:error?.code||'unknown',status:error?.status||null});
}
try{
  assert.ok(!findIdentity(),'fixture email already exists');
  await waitMailpit();
  docker('stop','--time','1',smtp);
  stopped=true;
  assert.equal(docker('inspect','--format','{{.State.Running}}',smtp),'false','SMTP did not stop');
  const opts={data:{full_name:'Local SMTP failure QA',kol_smtp_fixture:marker}};
  const {error:sendError}=await admin.auth.admin.inviteUserByEmail(email,opts);
  console.log('KOL_LOCAL_SMTP_OUTAGE_AUTH_RESULT',diagnostic(sendError));
  assert.ok(sendError && /smtp|mail|email|invite/i.test(sendError.message||'') &&
    !/rate.limit|too many|invalid.email|already.registered/i.test(sendError.message||''),
    'expected explicit SMTP invitation failure, not validation or rate limit');
  const orphan=findIdentity();
  if(orphan){
    assert.equal(orphan.roles,0,'failed invite has application roles');
    assert.equal(orphan.profiles,0,'failed invite has application profile');
    await removeOwned(orphan);
  }
  assert.ok(!findIdentity(),'failed invite fixture remains');
  console.log('KOL_LOCAL_SMTP_OUTAGE_FAIL_CLOSED_PASS');
  docker('start',smtp);
  stopped=false;
  await waitMailpit();
  await pause(2000);
  const {data:sent,error:retryError}=await admin.auth.admin.inviteUserByEmail(email,opts);
  console.log('KOL_LOCAL_SMTP_RETRY_AUTH_RESULT',diagnostic(retryError));
  assert.ok(!retryError && sent?.user?.id && sent.user.email===email,'same address retry after SMTP recovery failed');
  uid=sent.user.id;
  let delivered=false;
  for(let i=0;i<20;i++){
    const response=await fetch(mailUrl,{signal:AbortSignal.timeout(3000)});
    if(response.ok){
      const result=await response.json();
      delivered=(result.messages||[]).some(m=>(m.To||[]).some(to=>to.Address===email));
      if(delivered)break;
    }
    await pause(500);
  }
  assert.ok(delivered,'recovered invite was not received by local Mailpit');
  const user=findIdentity();
  assert.equal(user?.id,uid,'recovered invitation identity mismatch');
  assert.equal(user.owned,true,'recovered fixture marker mismatch');
  console.log('KOL_LOCAL_SMTP_RETRY_SAME_ADDRESS_DELIVERY_PASS');
}catch(error){
  failure=error;
  console.error('KOL_LOCAL_SMTP_PRIMARY_FAILURE',String(error?.message||'unknown failure').slice(0,250));
}finally{
  try{
    if(stopped){docker('start',smtp);await waitMailpit();}
  }catch(error){
    cleanupFailure=error;
    console.error('KOL_LOCAL_SMTP_RESTART_FAILURE');
  }
  try{
    const user=findIdentity();
    if(user)await removeOwned(user);
    assert.ok(!findIdentity(),'SMTP fixture cleanup failed');
    console.log('KOL_LOCAL_SMTP_RECOVERY_CLEANUP_PASS');
  }catch(error){
    cleanupFailure=cleanupFailure||error;
    console.error('KOL_LOCAL_SMTP_CLEANUP_FAILURE',String(error?.message||'unknown failure').slice(0,250));
  }
}
if(failure || cleanupFailure)process.exitCode=1;
else console.log('KOL_LOCAL_SMTP_RECOVERY_FINAL_PASS');
KOL_SMTP_FAULT
else
  echo "SMTP outage rehearsal runs only on isolated GitHub-hosted CI."
fi

echo "KÖL local Supabase staging smoke: PASS"

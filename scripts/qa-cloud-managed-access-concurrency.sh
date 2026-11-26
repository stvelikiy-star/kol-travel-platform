#!/usr/bin/env bash
# QA ONLY. All mutations rollback. Independent psql clients, not MCP calls.
set -euo pipefail
[[ "$GITHUB_ACTIONS" == true && "$GITHUB_REPOSITORY" == stvelikiy-star/kol-travel-platform ]]
[[ "$GITHUB_HEAD_REF" == release/kol-unified-qa-candidate-20261125 ]]
[[ "$KOL_DATABASE_URL" == *mphruawzozrpwcjgejhs* ]] || { echo 'Refusing non-QA database'; exit 1; }
dir=$(mktemp -d)
holder_pid=''
pids=()
cleanup() {
  if [[ -n "$holder_pid" ]]; then kill "$holder_pid" 2>/dev/null || true; fi
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  rm -rf "$dir"
}
trap cleanup EXIT
cat >"$dir/holder.sql" <<'SQL'
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='30s';
SET LOCAL lock_timeout='4s';
SELECT set_config('kol.qa.actor',(SELECT user_id::text FROM public.user_roles WHERE role='super_admin' AND is_active ORDER BY user_id LIMIT 1),true);
SELECT set_config('kol.qa.target',(SELECT user_id::text FROM public.user_roles WHERE role='content_manager' AND is_active ORDER BY user_id LIMIT 1),true);
SET LOCAL ROLE service_role;
DO $$ BEGIN
IF public.kol_update_managed_access_v1(current_setting('kol.qa.actor')::uuid,current_setting('kol.qa.target')::uuid,'change_role','finance_admin','QA concurrency rollback holder','content_manager','active',gen_random_uuid()) IS DISTINCT FROM 'updated' THEN RAISE EXCEPTION 'holder update failed'; END IF;
END $$;
\echo KOL_LOCK_HELD
SELECT pg_sleep(15);
ROLLBACK;
\echo KOL_HOLDER_ROLLBACK
SQL
cat >"$dir/contender.sql" <<'SQL'
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='10s';
SET LOCAL lock_timeout='750ms';
SELECT set_config('kol.qa.actor',(SELECT user_id::text FROM public.user_roles WHERE role='super_admin' AND is_active ORDER BY user_id DESC LIMIT 1),true);
SELECT set_config('kol.qa.target',(SELECT user_id::text FROM public.user_roles WHERE role='content_manager' AND is_active ORDER BY user_id LIMIT 1),true);
SET LOCAL ROLE service_role;
DO $$ BEGIN
BEGIN
PERFORM public.kol_update_managed_access_v1(current_setting('kol.qa.actor')::uuid,current_setting('kol.qa.target')::uuid,'change_role','support_admin','QA concurrency rollback contender','content_manager','active',gen_random_uuid());
RAISE EXCEPTION 'concurrent operation unexpectedly succeeded';
EXCEPTION WHEN lock_not_available THEN NULL;
END;
END $$;
ROLLBACK;
\echo KOL_CONTENTION_DENIED
SQL
run_wave() {
  local count="$1" i pid
  psql -X -q -d "$KOL_DATABASE_URL" -f "$dir/holder.sql" >"$dir/holder.log" 2>&1 &
  holder_pid=$!
  for i in $(seq 1 100); do
    grep -q '^KOL_LOCK_HELD$' "$dir/holder.log" && break
    kill -0 "$holder_pid" 2>/dev/null || { echo 'holder terminated before lock'; exit 1; }
    sleep 0.1
  done
  grep -q '^KOL_LOCK_HELD$' "$dir/holder.log"
  pids=()
  for i in $(seq 1 "$count"); do
    psql -X -q -d "$KOL_DATABASE_URL" -f "$dir/contender.sql" >"$dir/contender-$i.log" 2>&1 &
    pids+=("$!")
  done
  for pid in "${pids[@]}"; do wait "$pid"; done
  pids=()
  for i in $(seq 1 "$count"); do grep -q '^KOL_CONTENTION_DENIED$' "$dir/contender-$i.log"; done
  wait "$holder_pid"
  holder_pid=''
  grep -q '^KOL_HOLDER_ROLLBACK$' "$dir/holder.log"
  echo "KOL_ATOMIC_CONCURRENCY_PASS: holder + $count independent contenders"
}
run_wave 1
run_wave 9
psql -X -q -v ON_ERROR_STOP=1 -d "$KOL_DATABASE_URL" <<'SQL'
DO $$ BEGIN
IF NOT EXISTS(SELECT 1 FROM public.user_roles r JOIN public.admin_profiles a USING(user_id) JOIN public.user_profiles p USING(user_id) WHERE r.role='content_manager' AND r.is_active AND a.admin_level='content_manager' AND p.status='active') THEN RAISE EXCEPTION 'baseline lost'; END IF;
IF EXISTS(SELECT 1 FROM public.audit_logs WHERE reason IN ('QA concurrency rollback holder','QA concurrency rollback contender')) THEN RAISE EXCEPTION 'audit leakage'; END IF;
END $$;
SQL
echo 'KOL_ATOMIC_CONCURRENCY_CLEANUP_PASS'

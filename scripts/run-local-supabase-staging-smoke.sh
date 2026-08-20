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
supabase start -x studio,imgproxy,realtime,edge-runtime,logflare,vector

# Capture local credentials without echoing secret values to the Actions log.
supabase status -o env > /tmp/kol-supabase-local.env
set -a
# shellcheck disable=SC1091
source /tmp/kol-supabase-local.env
set +a

export SUPABASE_URL="${API_URL:-http://127.0.0.1:54321}"
export NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL"
export SUPABASE_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:?local Supabase SERVICE_ROLE_KEY missing}"
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

# Machine assertions that must be zero/true; unlike the human-readable VERIFY files,
# these make CI fail when core staging invariants are violated.
psql "$DB_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  v_bad_search_path integer;
  v_stage21 integer;
  v_delivery_mismatch integer;
BEGIN
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

echo "KÖL local Supabase staging smoke: PASS"

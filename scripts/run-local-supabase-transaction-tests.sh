#!/usr/bin/env bash
set -Eeuo pipefail

DB_URL="${1:-${SUPABASE_LOCAL_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}}"

CLIENT_ID="00000000-0000-0000-0000-000000000002"
ADMIN_ID="00000000-0000-0000-0000-000000000001"
COURIER_ID="00000000-0000-0000-0000-000000000004"
BUSINESS_ID="20000000-0000-0000-0000-000000000001"
ROOM_ID="42000000-0000-0000-0000-000000000001"
TOUR_ID="40000000-0000-0000-0000-000000000001"
DELIVERY_ID="52000000-0000-0000-0000-000000000001"
PRODUCT_REPLAY_ID="44000000-0000-0000-0000-000000000002"
PRODUCT_RACE_ID="44000000-0000-0000-0000-000000000003"
TOUR_SCHEDULE_ID="45000000-0000-0000-0000-000000000001"

fail() {
  echo "::error::$1" >&2
  exit 1
}

scalar() {
  psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "$1"
}

assert_true() {
  local label="$1"
  local sql="$2"
  local actual
  actual="$(scalar "$sql")"
  if [[ "$actual" != "t" ]]; then
    fail "${label}: expected true, got '${actual}'"
  fi
  echo "PASS: ${label}"
}

last_nonempty() {
  awk 'NF { line=$0 } END { print line }'
}

run_auth_sql() {
  local user_id="$1"
  local sql="$2"
  psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 <<SQL
begin;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '${user_id}', true);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
select pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.json_build_object('sub','${user_id}','role','authenticated')::text,
  true
);
${sql}
commit;
SQL
}

capture_auth_scalar() {
  local user_id="$1"
  local sql="$2"
  local output
  output="$(run_auth_sql "$user_id" "$sql")"
  printf '%s\n' "$output" | last_nonempty
}

expect_auth_failure() {
  local label="$1"
  local user_id="$2"
  local expected="$3"
  local sql="$4"
  local output rc
  set +e
  output="$(run_auth_sql "$user_id" "$sql" 2>&1)"
  rc=$?
  set -e
  if [[ $rc -eq 0 ]]; then
    fail "${label}: expected failure containing '${expected}', but call succeeded"
  fi
  if ! grep -Fq "$expected" <<<"$output"; then
    echo "$output" >&2
    fail "${label}: failure did not contain '${expected}'"
  fi
  echo "PASS: ${label} (${expected})"
}

run_service_sql() {
  local sql="$1"
  psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 <<SQL
begin;
set local role service_role;
${sql}
commit;
SQL
}

capture_service_scalar() {
  local sql="$1"
  local output
  output="$(run_service_sql "$sql")"
  printf '%s\n' "$output" | last_nonempty
}

expect_service_failure() {
  local label="$1"
  local expected="$2"
  local sql="$3"
  local output rc
  set +e
  output="$(run_service_sql "$sql" 2>&1)"
  rc=$?
  set -e
  if [[ $rc -eq 0 ]]; then
    fail "${label}: expected failure containing '${expected}', but call succeeded"
  fi
  if ! grep -Fq "$expected" <<<"$output"; then
    echo "$output" >&2
    fail "${label}: failure did not contain '${expected}'"
  fi
  echo "PASS: ${label} (${expected})"
}

race_two_auth_calls() {
  local label="$1"
  local sql_a="$2"
  local sql_b="$3"
  local expected_failure_regex="$4"
  local log_a="/tmp/kol-${label}-a.log"
  local log_b="/tmp/kol-${label}-b.log"
  local rc_a rc_b successes=0

  rm -f "$log_a" "$log_b"
  set +e
  run_auth_sql "$CLIENT_ID" "$sql_a" >"$log_a" 2>&1 &
  local pid_a=$!
  run_auth_sql "$CLIENT_ID" "$sql_b" >"$log_b" 2>&1 &
  local pid_b=$!
  wait "$pid_a"; rc_a=$?
  wait "$pid_b"; rc_b=$?
  set -e

  [[ $rc_a -eq 0 ]] && successes=$((successes + 1))
  [[ $rc_b -eq 0 ]] && successes=$((successes + 1))
  if [[ $successes -ne 1 ]]; then
    echo "--- ${label} A (rc=${rc_a}) ---" >&2
    cat "$log_a" >&2 || true
    echo "--- ${label} B (rc=${rc_b}) ---" >&2
    cat "$log_b" >&2 || true
    fail "${label}: expected exactly one successful concurrent call, got ${successes}"
  fi

  local loser_log
  if [[ $rc_a -ne 0 ]]; then loser_log="$log_a"; else loser_log="$log_b"; fi
  if ! grep -Eq "$expected_failure_regex" "$loser_log"; then
    cat "$loser_log" >&2 || true
    fail "${label}: losing transaction did not fail with expected inventory/capacity error"
  fi
  echo "PASS: ${label} concurrency serialized correctly"
}

echo "KÖL local transaction behavior tests"

# ---------------------------------------------------------------------------
# Local-only deterministic fixtures. This database is ephemeral and destroyed
# by the parent staging-smoke script after the workflow.
# ---------------------------------------------------------------------------
psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 <<SQL
insert into public.room_availability(room_id,date,status,available_count,price_override)
values
  ('${ROOM_ID}','2030-07-10','available',1,null),
  ('${ROOM_ID}','2030-07-11','available',1,null),
  ('${ROOM_ID}','2030-07-20','available',1,null)
on conflict (room_id,date) do update
set status='available', available_count=excluded.available_count, price_override=excluded.price_override;

insert into public.tour_schedules(id,tour_id,date,time,capacity,booked_count,status)
values ('${TOUR_SCHEDULE_ID}','${TOUR_ID}','2030-08-01','10:00',3,0,'available')
on conflict (id) do update
set capacity=excluded.capacity, booked_count=0, status='available';

insert into public.products(id,business_id,category_id,title,description,price,stock_qty,status)
values
  ('${PRODUCT_REPLAY_ID}','${BUSINESS_ID}','30000000-0000-0000-0000-000000000003','Local replay product','Ephemeral CI fixture',100,20,'active'),
  ('${PRODUCT_RACE_ID}','${BUSINESS_ID}','30000000-0000-0000-0000-000000000003','Local race product','Ephemeral CI fixture',75,1,'active')
on conflict (id) do update
set price=excluded.price, stock_qty=excluded.stock_qty, status='active';
SQL

# ---------------------------------------------------------------------------
# Stay booking: DB-authoritative price/inventory + idempotent replay.
# ---------------------------------------------------------------------------
stay_a="$(capture_auth_scalar "$CLIENT_ID" "select public.create_stay_booking_atomic('${ROOM_ID}'::uuid,'2030-07-10','2030-07-12',2,'stay-replay-0001');")"
stay_b="$(capture_auth_scalar "$CLIENT_ID" "select public.create_stay_booking_atomic('${ROOM_ID}'::uuid,'2030-07-10','2030-07-12',2,'stay-replay-0001');")"
[[ -n "$stay_a" && "$stay_a" == "$stay_b" ]] || fail "stay replay did not return the same booking id"
assert_true "stay replay decrements each night once" "select count(*)=2 and min(available_count)=0 and max(available_count)=0 from public.room_availability where room_id='${ROOM_ID}' and date in ('2030-07-10','2030-07-11')"
assert_true "stay total comes from database price" "select total=11000 and guests_count=2 from public.bookings where id='${stay_a}'::uuid"
expect_auth_failure "stay same-key changed payload" "$CLIENT_ID" "idempotency_key_payload_conflict" "select public.create_stay_booking_atomic('${ROOM_ID}'::uuid,'2030-07-10','2030-07-12',3,'stay-replay-0001');"

# Real row-lock race for the last room-night: one commit, one unavailable failure.
race_two_auth_calls \
  "stay-race" \
  "select public.create_stay_booking_atomic('${ROOM_ID}'::uuid,'2030-07-20','2030-07-21',1,'stay-race-0001');" \
  "select public.create_stay_booking_atomic('${ROOM_ID}'::uuid,'2030-07-20','2030-07-21',1,'stay-race-0002');" \
  "stay_not_available|stay_inventory_changed"
assert_true "stay race cannot overbook" "select available_count=0 from public.room_availability where room_id='${ROOM_ID}' and date='2030-07-20'"
assert_true "stay race commits exactly one booking" "select count(*)=1 from public.bookings where client_id='${CLIENT_ID}' and metadata->>'idempotency_key' in ('stay-race-0001','stay-race-0002')"

# ---------------------------------------------------------------------------
# Tour booking: capacity + idempotent payload binding.
# ---------------------------------------------------------------------------
tour_a="$(capture_auth_scalar "$CLIENT_ID" "select public.create_tour_booking_atomic('${TOUR_SCHEDULE_ID}'::uuid,2,'tour-replay-0001');")"
tour_b="$(capture_auth_scalar "$CLIENT_ID" "select public.create_tour_booking_atomic('${TOUR_SCHEDULE_ID}'::uuid,2,'tour-replay-0001');")"
[[ -n "$tour_a" && "$tour_a" == "$tour_b" ]] || fail "tour replay did not return the same booking id"
assert_true "tour replay increments capacity once" "select booked_count=2 and capacity=3 from public.tour_schedules where id='${TOUR_SCHEDULE_ID}'::uuid"
assert_true "tour total comes from database price" "select total=5000 and guests_count=2 from public.bookings where id='${tour_a}'::uuid"
expect_auth_failure "tour same-key changed participants" "$CLIENT_ID" "idempotency_key_payload_conflict" "select public.create_tour_booking_atomic('${TOUR_SCHEDULE_ID}'::uuid,1,'tour-replay-0001');"

# ---------------------------------------------------------------------------
# Shop order: normalized cart replay + stock truth + real stock race.
# ---------------------------------------------------------------------------
order_a="$(capture_auth_scalar "$CLIENT_ID" "select public.create_order_atomic('${BUSINESS_ID}'::uuid,'shop','[{\"item_id\":\"${PRODUCT_REPLAY_ID}\",\"qty\":1},{\"item_id\":\"${PRODUCT_REPLAY_ID}\",\"qty\":1}]'::jsonb,'pickup','order-replay-0001');")"
order_b="$(capture_auth_scalar "$CLIENT_ID" "select public.create_order_atomic('${BUSINESS_ID}'::uuid,'shop','[{\"item_id\":\"${PRODUCT_REPLAY_ID}\",\"qty\":2}]'::jsonb,'pickup','order-replay-0001');")"
[[ -n "$order_a" && "$order_a" == "$order_b" ]] || fail "order normalized replay did not return the same order id"
assert_true "order replay decrements stock once" "select stock_qty=18 from public.products where id='${PRODUCT_REPLAY_ID}'::uuid"
assert_true "order total comes from database price" "select subtotal=200 and total=200 and delivery_fee=0 and discount=0 from public.orders where id='${order_a}'::uuid"
assert_true "order snapshot is normalized" "select count(*)=1 and sum(qty)=2 and sum(total)=200 from public.order_items where order_id='${order_a}'::uuid"
expect_auth_failure "order same-key changed cart" "$CLIENT_ID" "idempotency_key_payload_conflict" "select public.create_order_atomic('${BUSINESS_ID}'::uuid,'shop','[{\"item_id\":\"${PRODUCT_REPLAY_ID}\",\"qty\":3}]'::jsonb,'pickup','order-replay-0001');"
assert_true "order conflict does not change stock" "select stock_qty=18 from public.products where id='${PRODUCT_REPLAY_ID}'::uuid"

race_two_auth_calls \
  "order-race" \
  "select public.create_order_atomic('${BUSINESS_ID}'::uuid,'shop','[{\"item_id\":\"${PRODUCT_RACE_ID}\",\"qty\":1}]'::jsonb,'pickup','order-race-0001');" \
  "select public.create_order_atomic('${BUSINESS_ID}'::uuid,'shop','[{\"item_id\":\"${PRODUCT_RACE_ID}\",\"qty\":1}]'::jsonb,'pickup','order-race-0002');" \
  "insufficient_product_stock|product_stock_changed"
assert_true "order race cannot oversell" "select stock_qty=0 from public.products where id='${PRODUCT_RACE_ID}'::uuid"
assert_true "order race commits exactly one order" "select count(*)=1 from public.orders where client_id='${CLIENT_ID}' and metadata->>'idempotency_key' in ('order-race-0001','order-race-0002')"

# ---------------------------------------------------------------------------
# Provider-neutral payment integrity: authoritative amount, exact replay,
# conflicting replay rejection, mismatch rejection, refunds remain disabled.
# ---------------------------------------------------------------------------
payment_a="$(capture_service_scalar "select public.create_payment_attempt_atomic('order','${order_a}'::uuid,'local-test','provider-ref-0001','card');")"
[[ -n "$payment_a" ]] || fail "payment attempt did not return an id"
assert_true "payment attempt amount equals parent authoritative total" "select p.amount=o.total and p.amount=200 and p.status='pending' from public.payments p join public.orders o on o.id=p.order_id where p.id='${payment_a}'::uuid"

capture_service_scalar "select public.apply_verified_payment_event_atomic('local-test','event-paid-0001','payment.succeeded','provider-ref-0001','paid',200,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','{}'::jsonb)::text;" >/dev/null
assert_true "verified paid event settles payment and parent" "select p.status='paid' and o.payment_status='paid' from public.payments p join public.orders o on o.id=p.order_id where p.id='${payment_a}'::uuid"

capture_service_scalar "select public.apply_verified_payment_event_atomic('local-test','event-paid-0001','payment.succeeded','provider-ref-0001','paid',200,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','{}'::jsonb)::text;" >/dev/null
assert_true "exact provider event replay is stored once" "select count(*)=1 from private.payment_provider_events where provider='local-test' and event_id='event-paid-0001'"
expect_service_failure "provider event replay with changed hash" "provider_event_replay_conflict" "select public.apply_verified_payment_event_atomic('local-test','event-paid-0001','payment.succeeded','provider-ref-0001','paid',200,'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','{}'::jsonb);"

capture_service_scalar "select public.apply_verified_payment_event_atomic('local-test','event-refund-0001','payment.refunded','provider-ref-0001','refunded',200,'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc','{}'::jsonb)::text;" >/dev/null
assert_true "refund event is recorded but automatic refund is disabled" "select p.status='paid' and o.payment_status='paid' and (select count(*) from public.refunds where payment_id=p.id)=0 and (select processing_status='ignored' from private.payment_provider_events where provider='local-test' and event_id='event-refund-0001') from public.payments p join public.orders o on o.id=p.order_id where p.id='${payment_a}'::uuid"

mismatch_order="$(scalar "select id from public.orders where client_id='${CLIENT_ID}' and metadata->>'idempotency_key' in ('order-race-0001','order-race-0002') limit 1")"
mismatch_total="$(scalar "select total from public.orders where id='${mismatch_order}'::uuid")"
payment_b="$(capture_service_scalar "select public.create_payment_attempt_atomic('order','${mismatch_order}'::uuid,'local-test','provider-ref-0002','card');")"
bad_amount="$(scalar "select (${mismatch_total}::numeric + 1)::text")"
capture_service_scalar "select public.apply_verified_payment_event_atomic('local-test','event-mismatch-0001','payment.succeeded','provider-ref-0002','paid',${bad_amount},'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd','{}'::jsonb)::text;" >/dev/null
assert_true "provider amount mismatch cannot settle parent" "select p.status='pending' and o.payment_status='pending' and (select processing_status='rejected' from private.payment_provider_events where provider='local-test' and event_id='event-mismatch-0001') from public.payments p join public.orders o on o.id=p.order_id where p.id='${payment_b}'::uuid"

# ---------------------------------------------------------------------------
# Delivery role and canonical state machine. Demo delivery is normalized by
# 012a/012b before this script runs.
# ---------------------------------------------------------------------------
capture_auth_scalar "$ADMIN_ID" "select public.assign_courier_atomic('${DELIVERY_ID}'::uuid,'${COURIER_ID}'::uuid,'local idempotent assignment')::text;" >/dev/null
assert_true "demo assignment normalized to one active courier" "select count(*)=1 from public.courier_assignments where delivery_id='${DELIVERY_ID}'::uuid and courier_id='${COURIER_ID}'::uuid and status in ('assigned','accepted','in_progress')"
expect_auth_failure "client cannot act as dispatcher" "$CLIENT_ID" "dispatcher_role_required" "select public.assign_courier_atomic('${DELIVERY_ID}'::uuid,'${COURIER_ID}'::uuid,'unauthorized');"
expect_auth_failure "client cannot progress courier delivery" "$CLIENT_ID" "courier_role_required" "select public.courier_transition_delivery_atomic('${DELIVERY_ID}'::uuid,'courier_accepted','unauthorized');"
expect_auth_failure "courier cannot skip canonical state" "$COURIER_ID" "invalid_delivery_status_transition" "select public.courier_transition_delivery_atomic('${DELIVERY_ID}'::uuid,'picked_up','skip');"

for status in courier_accepted courier_to_partner arrived_at_partner picked_up courier_to_client arrived_at_client delivered; do
  capture_auth_scalar "$COURIER_ID" "select public.courier_transition_delivery_atomic('${DELIVERY_ID}'::uuid,'${status}','local progression')::text;" >/dev/null
done

assert_true "delivery reaches terminal state" "select status='delivered' from public.deliveries where id='${DELIVERY_ID}'::uuid"
assert_true "terminal delivery has no active assignment" "select count(*)=0 from public.courier_assignments where delivery_id='${DELIVERY_ID}'::uuid and status in ('assigned','accepted','in_progress')"
assert_true "courier returns online after terminal delivery" "select availability_status='online' from public.courier_profiles where user_id='${COURIER_ID}'::uuid"
assert_true "delivery lifecycle never changes payment truth" "select o.payment_status='pending' from public.deliveries d join public.orders o on o.id=d.order_id where d.id='${DELIVERY_ID}'::uuid"
assert_true "canonical courier progress writes seven history rows" "select count(*)=7 from public.delivery_status_history where delivery_id='${DELIVERY_ID}'::uuid and reason='local progression'"
capture_auth_scalar "$COURIER_ID" "select public.courier_transition_delivery_atomic('${DELIVERY_ID}'::uuid,'delivered','idempotent replay')::text;" >/dev/null
assert_true "terminal same-status replay stays idempotent" "select status='delivered' from public.deliveries where id='${DELIVERY_ID}'::uuid"

echo "KÖL local transaction behavior tests: PASS"

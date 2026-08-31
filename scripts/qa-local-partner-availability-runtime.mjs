import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const playwrightModule = process.env.KOL_PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(playwrightModule);

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const secretApiKey = process.env.SECRET_KEY || process.env.SUPABASE_SECRET_KEY || serviceRoleKey;
const jwtSecret = process.env.JWT_SECRET;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const localDbUrl = process.env.SUPABASE_LOCAL_DB_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const appBaseUrl = process.argv[2] || process.env.KOL_LOCAL_APP_BASE_URL;

if (!supabaseUrl || !serviceRoleKey || !secretApiKey || !anonKey || !localDbUrl || !appBaseUrl) {
  throw new Error("Local Partner availability QA requires local Supabase credentials, database URL and application URL.");
}

function assertLocalUrl(value, label) {
  const url = new URL(value);
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new Error(`Refusing ${label} against non-local host: ${url.hostname}`);
  }
}
assertLocalUrl(supabaseUrl, "Partner availability Auth fixtures");
assertLocalUrl(localDbUrl, "Partner availability database fixtures");
assertLocalUrl(appBaseUrl, "Partner availability browser runtime");

const PASSWORD = "KolAvailability!2026";
const BUSINESS_A = "20000000-0000-0000-0000-000000000001";
const STAY_A = "41000000-0000-0000-0000-000000000001";
const ROOM_A = "42000000-0000-0000-0000-000000000001";
const TOUR_A = "40000000-0000-0000-0000-000000000001";
const RUN_SUFFIX = String(process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT || "1"}` : `${Date.now()}-${process.pid}`).replace(/[^a-zA-Z0-9-]/g, "-");
const specs = {
  partnerA: { email: `qa-availability-partner-a-${RUN_SUFFIX}@kol.test`, role: "partner_owner" },
  partnerB: { email: `qa-availability-partner-b-${RUN_SUFFIX}@kol.test`, role: "partner_owner" },
  client: { email: `qa-availability-client-${RUN_SUFFIX}@kol.test`, role: "client" }
};

function base64UrlJson(value) { return Buffer.from(JSON.stringify(value)).toString("base64url"); }
function createLocalServiceRoleJwt(secret) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: "HS256", typ: "JWT" });
  const payload = base64UrlJson({ iss: "supabase-demo", role: "service_role", iat: now, exp: now + 3600 });
  const signingInput = `${header}.${payload}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}
function getLocalAuthAdminBearer() {
  if (serviceRoleKey.startsWith("eyJ")) return serviceRoleKey;
  if (!jwtSecret) throw new Error("JWT_SECRET is required for opaque local service-role credentials.");
  return createLocalServiceRoleJwt(jwtSecret);
}
const authAdminBearer = getLocalAuthAdminBearer();

async function authAdminRequest(path, { method = "GET", body } = {}) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/admin${path}`, {
    method,
    headers: {
      apikey: secretApiKey,
      Authorization: `Bearer ${authAdminBearer}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = null; }
  }
  if (!response.ok) {
    const message = payload && typeof payload === "object" ? payload.message || payload.msg || payload.error || "auth admin error" : "auth admin error";
    throw new Error(`Local GoTrue Admin ${method} ${path} failed with HTTP ${response.status}: ${message}`);
  }
  return payload;
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}
function queryDbScalar(sql, label = "database query") {
  try {
    return execFileSync("psql", [localDbUrl, "-X", "-tA", "-v", "ON_ERROR_STOP=1", "-c", sql], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
  } catch (error) {
    const stderr = error?.stderr ? String(error.stderr).trim() : "";
    throw new Error(`${label}: ${stderr || error?.message || error}`);
  }
}
function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

async function createAuthUser(key) {
  const spec = specs[key];
  const payload = await authAdminRequest("/users", {
    method: "POST",
    body: {
      email: spec.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: `Partner availability QA ${key}`, local_partner_availability_qa: true }
    }
  });
  const user = payload?.user || payload;
  if (!user?.id) throw new Error(`Partner availability QA ${key} user returned no id`);
  return user.id;
}

const partnerAId = await createAuthUser("partnerA");
const partnerBId = await createAuthUser("partnerB");
const clientId = await createAuthUser("client");
const businessB = queryDbScalar("select gen_random_uuid()::text", "Partner B business id");

execFileSync("psql", [localDbUrl, "-X", "-v", "ON_ERROR_STOP=1", "-q"], {
  input: `begin;
insert into public.user_profiles (user_id,full_name,email,locale,status) values
  (${sqlLiteral(partnerAId)}::uuid,'QA Availability Partner A',${sqlLiteral(specs.partnerA.email)},'ru','active'),
  (${sqlLiteral(partnerBId)}::uuid,'QA Availability Partner B',${sqlLiteral(specs.partnerB.email)},'ru','active'),
  (${sqlLiteral(clientId)}::uuid,'QA Availability Client',${sqlLiteral(specs.client.email)},'ru','active');
insert into public.partners (id,owner_user_id,type,title,slug,description,location,address,phone,status,business_status,rating) values
  (${sqlLiteral(businessB)}::uuid,${sqlLiteral(partnerBId)}::uuid,'stay','QA Availability Partner B',${sqlLiteral(`qa-availability-b-${RUN_SUFFIX}`)},'Cross-owner QA business','Bosteri','Bosteri, Issyk-Kul','+996700000098','approved','online',5.0);
insert into public.user_roles (user_id,role,scope_id,is_active) values
  (${sqlLiteral(partnerAId)}::uuid,'partner_owner',${sqlLiteral(BUSINESS_A)}::uuid,true),
  (${sqlLiteral(partnerBId)}::uuid,'partner_owner',${sqlLiteral(businessB)}::uuid,true),
  (${sqlLiteral(clientId)}::uuid,'client',null,true);
insert into public.partner_profiles (user_id,business_id,position) values
  (${sqlLiteral(partnerAId)}::uuid,${sqlLiteral(BUSINESS_A)}::uuid,'QA availability owner A'),
  (${sqlLiteral(partnerBId)}::uuid,${sqlLiteral(businessB)}::uuid,'QA availability owner B');
insert into public.client_profiles (user_id,default_address) values (${sqlLiteral(clientId)}::uuid,'Partner availability QA client');
insert into public.partner_staff (business_id,user_id,role,is_active) values
  (${sqlLiteral(BUSINESS_A)}::uuid,${sqlLiteral(partnerAId)}::uuid,'partner_owner',true),
  (${sqlLiteral(businessB)}::uuid,${sqlLiteral(partnerBId)}::uuid,'partner_owner',true);
commit;
`,
  encoding: "utf8",
  stdio: ["pipe", "pipe", "pipe"]
});

const ids = {
  room: queryDbScalar("select gen_random_uuid()::text", "room availability id"),
  roomConcurrent: queryDbScalar("select gen_random_uuid()::text", "room concurrency id"),
  roomExhausted: queryDbScalar("select gen_random_uuid()::text", "room exhausted id"),
  tour: queryDbScalar("select gen_random_uuid()::text", "tour schedule id"),
  tourExhausted: queryDbScalar("select gen_random_uuid()::text", "tour exhausted id"),
  confirmedBooking: queryDbScalar("select gen_random_uuid()::text", "confirmed booking id")
};

execFileSync("psql", [localDbUrl, "-X", "-v", "ON_ERROR_STOP=1", "-q"], {
  input: `begin;
insert into public.room_availability (id,room_id,date,status,available_count,price_override) values
  (${sqlLiteral(ids.room)}::uuid,${sqlLiteral(ROOM_A)}::uuid,current_date + 21,'available',2,6100),
  (${sqlLiteral(ids.roomConcurrent)}::uuid,${sqlLiteral(ROOM_A)}::uuid,current_date + 22,'available',1,6200),
  (${sqlLiteral(ids.roomExhausted)}::uuid,${sqlLiteral(ROOM_A)}::uuid,current_date + 23,'closed',0,6300)
on conflict (room_id,date) do update set status=excluded.status,available_count=excluded.available_count,price_override=excluded.price_override,updated_at=now();
insert into public.tour_schedules (id,tour_id,date,time,capacity,booked_count,status) values
  (${sqlLiteral(ids.tour)}::uuid,${sqlLiteral(TOUR_A)}::uuid,current_date + 24,'14:00',7,2,'available'),
  (${sqlLiteral(ids.tourExhausted)}::uuid,${sqlLiteral(TOUR_A)}::uuid,current_date + 25,'15:00',3,3,'closed');
insert into public.bookings (id,client_id,business_id,booking_type,object_id,status,start_date,end_date,guests_count,total,payment_status,metadata) values
  (${sqlLiteral(ids.confirmedBooking)}::uuid,${sqlLiteral(clientId)}::uuid,${sqlLiteral(BUSINESS_A)}::uuid,'stay',${sqlLiteral(ROOM_A)}::uuid,'confirmed',current_date + 21,current_date + 22,2,6100,'pending',jsonb_build_object('qa','partner-availability-runtime'));
commit;
`,
  encoding: "utf8",
  stdio: ["pipe", "pipe", "pipe"]
});

function createUserClient() {
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}
async function signInClient(key) {
  const client = createUserClient();
  const { error } = await client.auth.signInWithPassword({ email: specs[key].email, password: PASSWORD });
  if (error) throw error;
  return client;
}

const partnerA = await signInClient("partnerA");

const { error: directRoomDmlError } = await partnerA.from("room_availability").update({ status: "closed" }).eq("id", ids.room);
if (!directRoomDmlError) throw new Error("Authenticated direct room_availability UPDATE unexpectedly succeeded");
const { error: directTourDmlError } = await partnerA.from("tour_schedules").update({ status: "closed" }).eq("id", ids.tour);
if (!directTourDmlError) throw new Error("Authenticated direct tour_schedules UPDATE unexpectedly succeeded");
console.log("Partner availability direct DML fail-closed: PASS");

const partnerB = await signInClient("partnerB");
const { error: crossOwnerError } = await partnerB.rpc("partner_availability_action_atomic", {
  p_scope_type: "room_date",
  p_scope_id: ids.room,
  p_action: "close",
  p_request_id: `cross-owner-${RUN_SUFFIX}`,
  p_reason: null
});
if (!crossOwnerError) throw new Error("Cross-owner Partner availability action unexpectedly succeeded");
await partnerB.auth.signOut({ scope: "local" });
console.log("Partner availability cross-owner mutation denied: PASS");

const client = await signInClient("client");
const { error: wrongRoleError } = await client.rpc("partner_availability_action_atomic", {
  p_scope_type: "room_date",
  p_scope_id: ids.room,
  p_action: "close",
  p_request_id: `wrong-role-${RUN_SUFFIX}`,
  p_reason: null
});
if (!wrongRoleError) throw new Error("Client unexpectedly executed Partner availability action");
console.log("Partner availability wrong-role mutation denied: PASS");

for (const [scopeType, scopeId, label] of [
  ["room_date", ids.roomExhausted, "exhausted room"],
  ["tour_schedule", ids.tourExhausted, "exhausted tour"]
]) {
  const { error } = await partnerA.rpc("partner_availability_action_atomic", {
    p_scope_type: scopeType,
    p_scope_id: scopeId,
    p_action: "open",
    p_request_id: `exhausted-${scopeType}-${RUN_SUFFIX}`,
    p_reason: null
  });
  if (!error) throw new Error(`${label} unexpectedly reopened without free inventory`);
}
console.log("Partner availability exhausted-inventory open fail-closed: PASS");

const concurrentResults = await Promise.all([
  partnerA.rpc("partner_availability_action_atomic", {
    p_scope_type: "room_date", p_scope_id: ids.roomConcurrent, p_action: "close", p_request_id: `concurrent-a-${RUN_SUFFIX}`, p_reason: null
  }),
  partnerA.rpc("partner_availability_action_atomic", {
    p_scope_type: "room_date", p_scope_id: ids.roomConcurrent, p_action: "close", p_request_id: `concurrent-b-${RUN_SUFFIX}`, p_reason: null
  })
]);
if (concurrentResults.some(({ error }) => error)) throw new Error("Concurrent duplicate availability close returned an unexpected error");
assertEqual(queryDbScalar(`select status from public.room_availability where id=${sqlLiteral(ids.roomConcurrent)}::uuid`, "concurrent room status"), "closed", "Concurrent close final status");
assertEqual(queryDbScalar(`select available_count::text from public.room_availability where id=${sqlLiteral(ids.roomConcurrent)}::uuid`, "concurrent room count"), "1", "Concurrent close preserves inventory count");
assertEqual(queryDbScalar(`select count(*)::text from public.audit_logs where entity_type='room_availability' and entity_id=${sqlLiteral(ids.roomConcurrent)}::uuid and action='partner_availability_room_date_close'`, "concurrent room audit count"), "1", "Concurrent duplicate close writes one state-change audit");
console.log("Partner availability duplicate-concurrency serialization: PASS");

async function pageStateExcerpt(page) {
  const text = await page.locator("body").innerText().catch(() => "<body unavailable>");
  return text.replace(/\s+/g, " ").trim().slice(0, 3000);
}

async function loginBrowserPage(page, nextPath) {
  await page.goto(`${appBaseUrl}/login?next=${encodeURIComponent(nextPath)}`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').fill(specs.partnerA.email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await Promise.all([
    page.waitForURL((url) => url.pathname === nextPath, { timeout: 15000 }),
    page.locator('button[type="submit"]').click()
  ]);
}

async function submitScopeAction(page, scopeId, action) {
  const form = page.locator(`form:has(input[name="scopeId"][value="${scopeId}"]):has(input[name="action"][value="${action}"])`).first();
  try {
    await form.waitFor({ state: "visible", timeout: 10000 });
    await form.locator('button[type="submit"]').click();
    await page.waitForURL((url) => url.searchParams.get("partnerAvailability") === "success" && url.searchParams.get("action") === action, { timeout: 15000 });
    await page.getByRole("status").waitFor({ timeout: 10000 });
  } catch (error) {
    const body = await pageStateExcerpt(page);
    throw new Error(`Availability browser action failed: scope=${scopeId} action=${action}; url=${page.url()}; body=${JSON.stringify(body)}; cause=${error?.message || error}`);
  }
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();

  await loginBrowserPage(page, "/partner/availability/rooms");
  await submitScopeAction(page, ids.room, "close");
  assertEqual(queryDbScalar(`select status from public.room_availability where id=${sqlLiteral(ids.room)}::uuid`, "browser room close status"), "closed", "Room close status");
  assertEqual(queryDbScalar(`select available_count::text from public.room_availability where id=${sqlLiteral(ids.room)}::uuid`, "browser room close count"), "2", "Room close preserves count");
  assertEqual(queryDbScalar(`select price_override::text from public.room_availability where id=${sqlLiteral(ids.room)}::uuid`, "browser room close price"), "6100", "Room close preserves price override");
  assertEqual(queryDbScalar(`select status||':'||payment_status from public.bookings where id=${sqlLiteral(ids.confirmedBooking)}::uuid`, "confirmed booking protection"), "confirmed:pending", "Room close preserves confirmed booking/payment");

  const { error: closedStayBookingError } = await client.rpc("create_stay_booking_atomic", {
    p_room_id: ROOM_A,
    p_start_date: queryDbScalar(`select date::text from public.room_availability where id=${sqlLiteral(ids.room)}::uuid`),
    p_end_date: queryDbScalar(`select (date + 1)::text from public.room_availability where id=${sqlLiteral(ids.room)}::uuid`),
    p_guests_count: 1,
    p_idempotency_key: `closed-room-${RUN_SUFFIX}`
  });
  if (!closedStayBookingError) throw new Error("Client booking unexpectedly succeeded on Partner-closed room date");
  assertEqual(queryDbScalar(`select available_count::text from public.room_availability where id=${sqlLiteral(ids.room)}::uuid`), "2", "Failed closed room booking preserves count");

  await submitScopeAction(page, ids.room, "open");
  assertEqual(queryDbScalar(`select status||':'||available_count::text||':'||price_override::text from public.room_availability where id=${sqlLiteral(ids.room)}::uuid`), "available:2:6100", "Room reopen preserves inventory/price");
  await submitScopeAction(page, ids.room, "report_conflict");
  assertEqual(queryDbScalar(`select status||':'||available_count::text from public.room_availability where id=${sqlLiteral(ids.room)}::uuid`), "available:2", "Conflict report preserves room state");
  assertEqual(queryDbScalar(`select count(*)::text from public.audit_logs where entity_type='room_availability' and entity_id=${sqlLiteral(ids.room)}::uuid and action='partner_availability_conflict_reported'`), "1", "Room conflict audit");
  console.log("Partner room availability browser→RPC→DB invariants: PASS");

  await page.goto(`${appBaseUrl}/partner/availability/tours`, { waitUntil: "domcontentloaded" });
  await submitScopeAction(page, ids.tour, "close");
  assertEqual(queryDbScalar(`select status||':'||capacity::text||':'||booked_count::text from public.tour_schedules where id=${sqlLiteral(ids.tour)}::uuid`, "browser tour close"), "closed:7:2", "Tour close preserves capacity counters");

  const { error: closedTourBookingError } = await client.rpc("create_tour_booking_atomic", {
    p_tour_schedule_id: ids.tour,
    p_participants: 1,
    p_idempotency_key: `closed-tour-${RUN_SUFFIX}`
  });
  if (!closedTourBookingError) throw new Error("Client booking unexpectedly succeeded on Partner-closed tour schedule");
  assertEqual(queryDbScalar(`select booked_count::text from public.tour_schedules where id=${sqlLiteral(ids.tour)}::uuid`), "2", "Failed closed tour booking preserves booked_count");

  await submitScopeAction(page, ids.tour, "open");
  assertEqual(queryDbScalar(`select status||':'||capacity::text||':'||booked_count::text from public.tour_schedules where id=${sqlLiteral(ids.tour)}::uuid`, "browser tour open"), "available:7:2", "Tour reopen preserves capacity counters");
  await submitScopeAction(page, ids.tour, "report_conflict");
  assertEqual(queryDbScalar(`select count(*)::text from public.audit_logs where entity_type='tour_schedules' and entity_id=${sqlLiteral(ids.tour)}::uuid and action='partner_availability_conflict_reported'`), "1", "Tour conflict audit");
  console.log("Partner tour availability browser→RPC→DB invariants: PASS");

  await context.close();
} finally {
  await browser.close();
  await partnerA.auth.signOut({ scope: "local" });
  await client.auth.signOut({ scope: "local" });
}

console.log("KÖL local Partner availability operational browser runtime: PASS");

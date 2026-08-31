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
  throw new Error("Local Partner booking QA requires local Supabase credentials, database URL and application URL.");
}

function assertLocalUrl(value, label) {
  const url = new URL(value);
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new Error(`Refusing ${label} against non-local host: ${url.hostname}`);
  }
}
assertLocalUrl(supabaseUrl, "partner booking Auth fixtures");
assertLocalUrl(localDbUrl, "partner booking database fixtures");
assertLocalUrl(appBaseUrl, "partner booking browser runtime");

const PASSWORD = "KolPartner!2026";
const BUSINESS_A = "20000000-0000-0000-0000-000000000001";
const STAY_A = "41000000-0000-0000-0000-000000000001";
const ROOM_A = "42000000-0000-0000-0000-000000000001";
const RUN_SUFFIX = String(process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT || "1"}` : `${Date.now()}-${process.pid}`).replace(/[^a-zA-Z0-9-]/g, "-");
const specs = {
  partnerA: { email: `qa-partner-a-${RUN_SUFFIX}@kol.test`, role: "partner_owner" },
  partnerB: { email: `qa-partner-b-${RUN_SUFFIX}@kol.test`, role: "partner_owner" },
  client: { email: `qa-partner-client-${RUN_SUFFIX}@kol.test`, role: "client" }
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

function safeAuthErrorBody(value) {
  if (!value || typeof value !== "object") return "no structured error body";
  for (const field of ["message", "msg", "error_description", "error_code", "code", "error"]) {
    if (typeof value[field] === "string" && value[field]) return `${field}=${value[field]}`;
  }
  return `fields=${Object.keys(value).sort().join(",") || "none"}`;
}

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
    throw new Error(`Local GoTrue Admin ${method} ${path} failed with HTTP ${response.status}: ${safeAuthErrorBody(payload)}`);
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
      user_metadata: { name: `Partner booking QA ${key}`, local_partner_booking_qa: true }
    }
  });
  const user = payload?.user || payload;
  if (!user?.id) throw new Error(`Partner booking QA ${key} user returned no id`);
  return user.id;
}

const partnerAId = await createAuthUser("partnerA");
const partnerBId = await createAuthUser("partnerB");
const clientId = await createAuthUser("client");
const businessB = queryDbScalar("select gen_random_uuid()::text", "partner B business id");

execFileSync("psql", [localDbUrl, "-X", "-v", "ON_ERROR_STOP=1", "-q"], {
  input: `begin;
insert into public.user_profiles (user_id,full_name,email,locale,status) values
  (${sqlLiteral(partnerAId)}::uuid,'QA Partner A',${sqlLiteral(specs.partnerA.email)},'ru','active'),
  (${sqlLiteral(partnerBId)}::uuid,'QA Partner B',${sqlLiteral(specs.partnerB.email)},'ru','active'),
  (${sqlLiteral(clientId)}::uuid,'QA Client',${sqlLiteral(specs.client.email)},'ru','active');
insert into public.partners (id,owner_user_id,type,title,slug,description,location,address,phone,status,business_status,rating) values
  (${sqlLiteral(businessB)}::uuid,${sqlLiteral(partnerBId)}::uuid,'stay','QA Isolated Partner B',${sqlLiteral(`qa-partner-b-${RUN_SUFFIX}`)},'Cross-owner QA business','Bosteri','Bosteri, Issyk-Kul','+996700000099','approved','online',5.0);
insert into public.user_roles (user_id,role,scope_id,is_active) values
  (${sqlLiteral(partnerAId)}::uuid,'partner_owner',${sqlLiteral(BUSINESS_A)}::uuid,true),
  (${sqlLiteral(partnerBId)}::uuid,'partner_owner',${sqlLiteral(businessB)}::uuid,true),
  (${sqlLiteral(clientId)}::uuid,'client',null,true);
insert into public.partner_profiles (user_id,business_id,position) values
  (${sqlLiteral(partnerAId)}::uuid,${sqlLiteral(BUSINESS_A)}::uuid,'QA owner A'),
  (${sqlLiteral(partnerBId)}::uuid,${sqlLiteral(businessB)}::uuid,'QA owner B');
insert into public.client_profiles (user_id,default_address) values (${sqlLiteral(clientId)}::uuid,'Partner booking QA client');
insert into public.partner_staff (business_id,user_id,role,is_active) values
  (${sqlLiteral(BUSINESS_A)}::uuid,${sqlLiteral(partnerAId)}::uuid,'partner_owner',true),
  (${sqlLiteral(businessB)}::uuid,${sqlLiteral(partnerBId)}::uuid,'partner_owner',true);
commit;
`,
  encoding: "utf8",
  stdio: ["pipe", "pipe", "pipe"]
});

const fixtureIds = {
  confirm: queryDbScalar("select gen_random_uuid()::text", "confirm fixture id"),
  reject: queryDbScalar("select gen_random_uuid()::text", "reject fixture id"),
  checkIn: queryDbScalar("select gen_random_uuid()::text", "check-in fixture id"),
  cancellation: queryDbScalar("select gen_random_uuid()::text", "cancellation fixture id"),
  issue: queryDbScalar("select gen_random_uuid()::text", "issue fixture id"),
  invalidTransition: queryDbScalar("select gen_random_uuid()::text", "invalid transition fixture id")
};

const bookingRows = [
  [fixtureIds.confirm, "pending", 5101],
  [fixtureIds.reject, "pending", 5102],
  [fixtureIds.checkIn, "confirmed", 5103],
  [fixtureIds.cancellation, "confirmed", 5104],
  [fixtureIds.issue, "pending", 5105],
  [fixtureIds.invalidTransition, "pending", 5106]
].map(([id, status, total], index) => `(${sqlLiteral(id)}::uuid,${sqlLiteral(clientId)}::uuid,${sqlLiteral(BUSINESS_A)}::uuid,'stay',${sqlLiteral(ROOM_A)}::uuid,${sqlLiteral(status)},current_date + ${10 + index},current_date + ${12 + index},2,${total},'pending',jsonb_build_object('qa','partner-booking-runtime'))`).join(",\n");

execFileSync("psql", [localDbUrl, "-X", "-v", "ON_ERROR_STOP=1", "-q"], {
  input: `insert into public.bookings (id,client_id,business_id,booking_type,object_id,status,start_date,end_date,guests_count,total,payment_status,metadata) values\n${bookingRows};\n`,
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

// Direct table mutation must remain unavailable to authenticated callers.
const directPartner = await signInClient("partnerA");
const { error: directUpdateError } = await directPartner.from("bookings").update({ status: "completed" }).eq("id", fixtureIds.confirm);
if (!directUpdateError) throw new Error("Authenticated direct booking UPDATE unexpectedly succeeded");
assertEqual(queryDbScalar(`select status from public.bookings where id=${sqlLiteral(fixtureIds.confirm)}::uuid`, "post-direct-update status"), "pending", "Direct UPDATE leaves booking unchanged");
console.log("Partner direct booking DML fail-closed: PASS");

// Prove the authenticated Partner can read the exact booking/object before the browser/SSR layer.
const { data: visibleBooking, error: visibleBookingError } = await directPartner
  .from("bookings")
  .select("id,status,business_id,object_id,payment_status")
  .eq("id", fixtureIds.confirm)
  .maybeSingle();
if (visibleBookingError || !visibleBooking) {
  throw new Error(`Partner authenticated booking read preflight failed: ${visibleBookingError?.message || "booking not visible"}`);
}
assertEqual(visibleBooking.id, fixtureIds.confirm, "Partner preflight booking id");
assertEqual(visibleBooking.status, "pending", "Partner preflight booking status");
assertEqual(visibleBooking.business_id, BUSINESS_A, "Partner preflight booking ownership");
assertEqual(visibleBooking.object_id, ROOM_A, "Partner preflight booking room object");
assertEqual(visibleBooking.payment_status, "pending", "Partner preflight payment truth");

const { data: visibleRoom, error: visibleRoomError } = await directPartner
  .from("rooms")
  .select("id,stay_id,business_id,title,status")
  .eq("id", ROOM_A)
  .maybeSingle();
if (visibleRoomError || !visibleRoom) {
  throw new Error(`Partner authenticated room read preflight failed: ${visibleRoomError?.message || "room not visible"}`);
}
assertEqual(visibleRoom.business_id, BUSINESS_A, "Partner preflight room ownership");
assertEqual(visibleRoom.stay_id, STAY_A, "Partner preflight room stay relation");

const { data: visibleStay, error: visibleStayError } = await directPartner
  .from("stays")
  .select("id,business_id,title,status")
  .eq("id", STAY_A)
  .maybeSingle();
if (visibleStayError || !visibleStay) {
  throw new Error(`Partner authenticated stay read preflight failed: ${visibleStayError?.message || "stay not visible"}`);
}
assertEqual(visibleStay.business_id, BUSINESS_A, "Partner preflight stay ownership");
console.log("Partner authenticated booking/room/stay read preflight: PASS");

// Cross-owner Partner must not be able to operate another business booking.
const directPartnerB = await signInClient("partnerB");
const { error: crossOwnerError } = await directPartnerB.rpc("partner_booking_action_atomic", {
  p_booking_id: fixtureIds.confirm,
  p_action: "confirm",
  p_request_id: `cross-owner-${RUN_SUFFIX}`,
  p_reason: null
});
if (!crossOwnerError) throw new Error("Cross-owner Partner booking action unexpectedly succeeded");
assertEqual(queryDbScalar(`select status from public.bookings where id=${sqlLiteral(fixtureIds.confirm)}::uuid`, "post-cross-owner status"), "pending", "Cross-owner action leaves booking unchanged");
await directPartnerB.auth.signOut({ scope: "local" });
console.log("Partner cross-owner booking mutation denied: PASS");

// Wrong-role Client must not be able to use Partner RPC.
const directClient = await signInClient("client");
const { error: wrongRoleError } = await directClient.rpc("partner_booking_action_atomic", {
  p_booking_id: fixtureIds.confirm,
  p_action: "confirm",
  p_request_id: `wrong-role-${RUN_SUFFIX}`,
  p_reason: null
});
if (!wrongRoleError) throw new Error("Client unexpectedly executed Partner booking action");
await directClient.auth.signOut({ scope: "local" });
console.log("Wrong-role Partner booking mutation denied: PASS");

// Invalid status transition must fail without writing history.
const { error: invalidTransitionError } = await directPartner.rpc("partner_booking_action_atomic", {
  p_booking_id: fixtureIds.invalidTransition,
  p_action: "check_in",
  p_request_id: `invalid-transition-${RUN_SUFFIX}`,
  p_reason: null
});
if (!invalidTransitionError) throw new Error("Invalid pending→checked_in transition unexpectedly succeeded");
assertEqual(queryDbScalar(`select status from public.bookings where id=${sqlLiteral(fixtureIds.invalidTransition)}::uuid`, "invalid transition status"), "pending", "Invalid transition leaves booking unchanged");
assertEqual(queryDbScalar(`select count(*)::text from public.booking_status_history where booking_id=${sqlLiteral(fixtureIds.invalidTransition)}::uuid`, "invalid transition history"), "0", "Invalid transition writes no history");
console.log("Invalid Partner booking transition fail-closed: PASS");

async function pageStateExcerpt(page) {
  const text = await page.locator("body").innerText().catch(() => "<body unavailable>");
  return text.replace(/\s+/g, " ").trim().slice(0, 3000);
}

async function requireBookingActionPage(page, bookingId) {
  try {
    await page.getByText(bookingId, { exact: true }).first().waitFor({ timeout: 10000 });
    await page.getByText("Управление бронью", { exact: true }).waitFor({ timeout: 10000 });
  } catch (error) {
    const body = await pageStateExcerpt(page);
    throw new Error(`Partner booking page contract failed for ${bookingId}; url=${page.url()}; body=${JSON.stringify(body)}; cause=${error?.message || error}`);
  }
}

async function loginBrowserPage(page, nextPath, bookingId) {
  await page.goto(`${appBaseUrl}/login?next=${encodeURIComponent(nextPath)}`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').fill(specs.partnerA.email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await Promise.all([
    page.waitForURL((url) => url.pathname === nextPath, { timeout: 15000 }),
    page.locator('button[type="submit"]').click()
  ]);
  await requireBookingActionPage(page, bookingId);
}

async function openBooking(page, bookingId) {
  await page.goto(`${appBaseUrl}/partner/bookings/${bookingId}`, { waitUntil: "domcontentloaded" });
  await requireBookingActionPage(page, bookingId);
}

async function submitAndRequireSuccess(page, label, action) {
  const button = page.getByRole("button", { name: label, exact: true });
  try {
    await button.waitFor({ state: "visible", timeout: 10000 });
  } catch (error) {
    const body = await pageStateExcerpt(page);
    throw new Error(`Partner booking action control missing: label=${JSON.stringify(label)} action=${action}; url=${page.url()}; body=${JSON.stringify(body)}; cause=${error?.message || error}`);
  }
  await button.click();
  await page.waitForURL((url) => url.searchParams.get("partnerAction") === "success" && url.searchParams.get("action") === action, { timeout: 15000 });
  await page.getByRole("status").waitFor({ timeout: 10000 });
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginBrowserPage(page, `/partner/bookings/${fixtureIds.confirm}`, fixtureIds.confirm);

  await submitAndRequireSuccess(page, "Подтвердить бронь", "confirm");
  assertEqual(queryDbScalar(`select status from public.bookings where id=${sqlLiteral(fixtureIds.confirm)}::uuid`, "browser confirm status"), "confirmed", "Browser confirm booking status");
  assertEqual(queryDbScalar(`select payment_status from public.bookings where id=${sqlLiteral(fixtureIds.confirm)}::uuid`, "browser confirm payment"), "pending", "Confirm preserves payment truth");
  assertEqual(queryDbScalar(`select count(*)::text from public.booking_status_history where booking_id=${sqlLiteral(fixtureIds.confirm)}::uuid and from_status='pending' and to_status='confirmed' and changed_by=${sqlLiteral(partnerAId)}::uuid and reason='partner_booking_confirm_atomic'`, "browser confirm history"), "1", "Confirm history actor/reason");

  // Exact-target replay is idempotent and does not append history twice.
  const { data: replayData, error: replayError } = await directPartner.rpc("partner_booking_action_atomic", {
    p_booking_id: fixtureIds.confirm,
    p_action: "confirm",
    p_request_id: `confirm-replay-${RUN_SUFFIX}`,
    p_reason: null
  });
  if (replayError || !replayData || replayData.idempotent !== true) throw new Error("Confirmed booking replay did not return idempotent success");
  assertEqual(queryDbScalar(`select count(*)::text from public.booking_status_history where booking_id=${sqlLiteral(fixtureIds.confirm)}::uuid and to_status='confirmed'`, "confirm replay history"), "1", "Confirm replay writes no duplicate history");
  console.log("Partner browser confirm + DB/history/payment + idempotency: PASS");

  await openBooking(page, fixtureIds.reject);
  await submitAndRequireSuccess(page, "Отклонить бронь", "reject");
  assertEqual(queryDbScalar(`select status from public.bookings where id=${sqlLiteral(fixtureIds.reject)}::uuid`, "browser reject status"), "rejected", "Browser reject booking status");
  assertEqual(queryDbScalar(`select payment_status from public.bookings where id=${sqlLiteral(fixtureIds.reject)}::uuid`, "browser reject payment"), "pending", "Reject preserves payment truth");
  assertEqual(queryDbScalar(`select count(*)::text from public.booking_status_history where booking_id=${sqlLiteral(fixtureIds.reject)}::uuid and from_status='pending' and to_status='rejected' and changed_by=${sqlLiteral(partnerAId)}::uuid`, "browser reject history"), "1", "Reject history actor");
  console.log("Partner browser reject + DB/history/payment: PASS");

  await openBooking(page, fixtureIds.checkIn);
  await submitAndRequireSuccess(page, "Отметить прибытие", "check_in");
  assertEqual(queryDbScalar(`select status from public.bookings where id=${sqlLiteral(fixtureIds.checkIn)}::uuid`, "browser check-in status"), "checked_in", "Browser check-in booking status");
  assertEqual(queryDbScalar(`select payment_status from public.bookings where id=${sqlLiteral(fixtureIds.checkIn)}::uuid`, "browser check-in payment"), "pending", "Check-in preserves payment truth");
  assertEqual(queryDbScalar(`select count(*)::text from public.booking_status_history where booking_id=${sqlLiteral(fixtureIds.checkIn)}::uuid and from_status='confirmed' and to_status='checked_in' and changed_by=${sqlLiteral(partnerAId)}::uuid`, "browser check-in history"), "1", "Check-in history actor");
  console.log("Partner browser check-in + DB/history/payment: PASS");

  await openBooking(page, fixtureIds.cancellation);
  await submitAndRequireSuccess(page, "Запросить отмену", "request_cancellation");
  assertEqual(queryDbScalar(`select status from public.bookings where id=${sqlLiteral(fixtureIds.cancellation)}::uuid`, "cancellation request status"), "confirmed", "Cancellation request preserves booking status");
  assertEqual(queryDbScalar(`select payment_status from public.bookings where id=${sqlLiteral(fixtureIds.cancellation)}::uuid`, "cancellation request payment"), "pending", "Cancellation request preserves payment truth");
  assertEqual(queryDbScalar(`select count(*)::text from public.booking_status_history where booking_id=${sqlLiteral(fixtureIds.cancellation)}::uuid and to_status='cancelled'`, "cancellation request history"), "0", "Cancellation request does not cancel booking");
  assertEqual(queryDbScalar(`select count(*)::text from public.audit_logs where entity_type='bookings' and entity_id=${sqlLiteral(fixtureIds.cancellation)}::uuid and actor_id=${sqlLiteral(partnerAId)}::uuid and action='partner_booking_cancellation_requested'`, "cancellation request audit"), "1", "Cancellation request audit");
  console.log("Partner browser cancellation request audit-only invariant: PASS");

  await openBooking(page, fixtureIds.issue);
  await submitAndRequireSuccess(page, "Сообщить проблему", "report_issue");
  assertEqual(queryDbScalar(`select status from public.bookings where id=${sqlLiteral(fixtureIds.issue)}::uuid`, "issue report status"), "pending", "Issue report preserves booking status");
  assertEqual(queryDbScalar(`select payment_status from public.bookings where id=${sqlLiteral(fixtureIds.issue)}::uuid`, "issue report payment"), "pending", "Issue report preserves payment truth");
  assertEqual(queryDbScalar(`select count(*)::text from public.audit_logs where entity_type='bookings' and entity_id=${sqlLiteral(fixtureIds.issue)}::uuid and actor_id=${sqlLiteral(partnerAId)}::uuid and action='partner_booking_issue_reported'`, "issue report audit"), "1", "Issue report audit");
  console.log("Partner browser issue report audit-only invariant: PASS");

  await context.close();
} finally {
  await browser.close();
  await directPartner.auth.signOut({ scope: "local" });
}

console.log("KÖL local Partner booking operational browser runtime: PASS");
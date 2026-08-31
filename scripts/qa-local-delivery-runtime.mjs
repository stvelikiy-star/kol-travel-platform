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

if (!supabaseUrl || !serviceRoleKey || !secretApiKey || !anonKey || !localDbUrl || !appBaseUrl) throw new Error("Local delivery runtime QA requires local Supabase credentials, database URL and application URL.");

function assertLocalUrl(value, label) {
  const url = new URL(value);
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") throw new Error(`Refusing ${label} against non-local host: ${url.hostname}`);
}
assertLocalUrl(supabaseUrl, "delivery Auth fixtures");
assertLocalUrl(localDbUrl, "delivery database fixtures");
assertLocalUrl(appBaseUrl, "delivery browser runtime");

const PASSWORD = "KolDelivery!2026";
const BUSINESS_ID = "20000000-0000-0000-0000-000000000001";
const RUN_SUFFIX = String(process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT || "1"}` : `${Date.now()}-${process.pid}`).replace(/[^a-zA-Z0-9-]/g, "-");
const specs = {
  client: { email: `qa-delivery-client-${RUN_SUFFIX}@kol.test`, role: "client" },
  courier: { email: `qa-delivery-courier-${RUN_SUFFIX}@kol.test`, role: "courier" },
  admin: { email: `qa-delivery-admin-${RUN_SUFFIX}@kol.test`, role: "super_admin" }
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
  for (const field of ["message", "msg", "error_description", "error_code", "code", "error"]) if (typeof value[field] === "string" && value[field]) return `${field}=${value[field]}`;
  return `fields=${Object.keys(value).sort().join(",") || "none"}`;
}
async function authAdminRequest(path, { method = "GET", body } = {}) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/admin${path}`, {
    method,
    headers: { apikey: secretApiKey, Authorization: `Bearer ${authAdminBearer}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let payload = null;
  if (text) try { payload = JSON.parse(text); } catch { payload = null; }
  if (!response.ok) throw new Error(`Local GoTrue Admin ${method} ${path} failed with HTTP ${response.status}: ${safeAuthErrorBody(payload)}`);
  return payload;
}

function sqlLiteral(value) { return value === null || value === undefined ? "null" : `'${String(value).replaceAll("'", "''")}'`; }
function queryDbScalar(sql, label = "database query") {
  try {
    return execFileSync("psql", [localDbUrl, "-X", "-tA", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    const stderr = error?.stderr ? String(error.stderr).trim() : "";
    throw new Error(`${label}: ${stderr || error?.message || error}`);
  }
}
function assertEqual(actual, expected, label) { if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }

async function createAuthUser(key) {
  const spec = specs[key];
  const payload = await authAdminRequest("/users", { method: "POST", body: { email: spec.email, password: PASSWORD, email_confirm: true, user_metadata: { name: `Delivery QA ${key}`, local_delivery_qa: true } } });
  const user = payload?.user || payload;
  if (!user?.id) throw new Error(`Delivery QA ${key} user returned no id`);
  return user.id;
}

function insertIdentityFixture(key, userId) {
  const spec = specs[key];
  const statements = [
    `insert into public.user_profiles (user_id,full_name,email,locale,status) values (${sqlLiteral(userId)}::uuid,${sqlLiteral(`Delivery QA ${key}`)},${sqlLiteral(spec.email)},'ru','active');`,
    `insert into public.user_roles (user_id,role,scope_id,is_active) values (${sqlLiteral(userId)}::uuid,${sqlLiteral(spec.role)},null,true);`
  ];
  if (key === "client") statements.push(`insert into public.client_profiles (user_id,default_address) values (${sqlLiteral(userId)}::uuid,'Delivery QA address');`);
  if (key === "courier") statements.push(`insert into public.courier_profiles (user_id,vehicle_type,vehicle_number,working_zone,availability_status) values (${sqlLiteral(userId)}::uuid,'car','QA-DELIVERY','Cholpon-Ata','online');`);
  if (key === "admin") statements.push(`insert into public.admin_profiles (user_id,admin_level,department) values (${sqlLiteral(userId)}::uuid,'super_admin','delivery-qa');`);
  execFileSync("psql", [localDbUrl, "-X", "-v", "ON_ERROR_STOP=1", "-q"], { input: `begin;\n${statements.join("\n")}\ncommit;\n`, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
}

async function loginBrowserPage(page, key, nextPath) {
  await page.goto(`${appBaseUrl}/login?next=${encodeURIComponent(nextPath)}`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').fill(specs[key].email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await Promise.all([page.waitForURL((url) => url.pathname === nextPath, { timeout: 15000 }), page.locator('button[type="submit"]').click()]);
}

const clientId = await createAuthUser("client");
const courierId = await createAuthUser("courier");
const adminId = await createAuthUser("admin");
insertIdentityFixture("client", clientId);
insertIdentityFixture("courier", courierId);
insertIdentityFixture("admin", adminId);

const orderId = queryDbScalar("select gen_random_uuid()::text", "delivery QA order id");
const deliveryId = queryDbScalar("select gen_random_uuid()::text", "delivery QA delivery id");
execFileSync("psql", [localDbUrl, "-X", "-v", "ON_ERROR_STOP=1", "-q"], {
  input: `begin;\ninsert into public.orders (id,client_id,business_id,type,status,subtotal,delivery_fee,discount,total,payment_status,metadata) values (${sqlLiteral(orderId)}::uuid,${sqlLiteral(clientId)}::uuid,${sqlLiteral(BUSINESS_ID)}::uuid,'shop','ready_for_pickup',100,25,0,125,'pending','{"qa":"delivery-browser"}'::jsonb);\ninsert into public.deliveries (id,order_id,status,pickup_address,dropoff_address,risk_level,metadata) values (${sqlLiteral(deliveryId)}::uuid,${sqlLiteral(orderId)}::uuid,'delivery_pending','QA Partner Pickup','QA Client Dropoff','low','{"qa":"delivery-browser"}'::jsonb);\ninsert into public.order_delivery (order_id,delivery_id,delivery_method,pickup_address,dropoff_address) values (${sqlLiteral(orderId)}::uuid,${sqlLiteral(deliveryId)}::uuid,'delivery','QA Partner Pickup','QA Client Dropoff');\ncommit;\n`,
  encoding: "utf8", stdio: ["pipe", "pipe", "pipe"]
});

const browser = await chromium.launch({ headless: true });
try {
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await loginBrowserPage(adminPage, "admin", "/admin/delivery");
  await adminPage.getByText(orderId, { exact: true }).waitFor({ timeout: 10000 });
  const courierSelect = adminPage.getByLabel(`Курьер для доставки ${deliveryId}`);
  await courierSelect.waitFor({ timeout: 10000 });
  await courierSelect.selectOption(courierId);
  await adminPage.getByRole("button", { name: "Назначить курьера", exact: true }).click();
  await adminPage.getByRole("status").filter({ hasText: "Курьер назначен сервером" }).waitFor({ timeout: 15000 });

  assertEqual(queryDbScalar(`select status from public.deliveries where id=${sqlLiteral(deliveryId)}::uuid`, "admin assignment delivery status"), "courier_assigned", "Admin browser assignment status");
  assertEqual(queryDbScalar(`select assigned_courier_id::text from public.deliveries where id=${sqlLiteral(deliveryId)}::uuid`, "admin assignment courier"), courierId, "Admin browser assignment courier");
  assertEqual(queryDbScalar(`select count(*)::text from public.courier_assignments where delivery_id=${sqlLiteral(deliveryId)}::uuid and courier_id=${sqlLiteral(courierId)}::uuid and status='assigned'`, "admin assignment row"), "1", "Admin browser assignment row");
  assertEqual(queryDbScalar(`select count(*)::text from public.delivery_status_history where delivery_id=${sqlLiteral(deliveryId)}::uuid and to_status='courier_assigned' and changed_by=${sqlLiteral(adminId)}::uuid and reason='admin_ui_assignment'`, "admin assignment history"), "1", "Admin assignment history actor");
  console.log("Admin browser courier assignment + DB truth: PASS");
  await adminContext.close();

  const directCourier = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { error: signInError } = await directCourier.auth.signInWithPassword({ email: specs.courier.email, password: PASSWORD });
  if (signInError) throw signInError;
  const { error: skipError } = await directCourier.rpc("courier_transition_delivery_atomic", { p_delivery_id: deliveryId, p_to_status: "picked_up", p_reason: "qa_invalid_skip" });
  if (!skipError) throw new Error("Courier invalid state skip unexpectedly succeeded");
  assertEqual(queryDbScalar(`select status from public.deliveries where id=${sqlLiteral(deliveryId)}::uuid`, "post-skip delivery status"), "courier_assigned", "Invalid skip leaves delivery unchanged");
  await directCourier.auth.signOut({ scope: "local" });
  console.log("Courier invalid state skip fail-closed: PASS");

  const courierContext = await browser.newContext();
  const courierPage = await courierContext.newPage();
  await loginBrowserPage(courierPage, "courier", "/courier/active");
  await courierPage.getByText(deliveryId, { exact: true }).waitFor({ timeout: 10000 });

  const transitions = [
    ["courier_accepted", "Принять доставку"],
    ["courier_to_partner", "Выехать к партнёру"],
    ["arrived_at_partner", "Подтвердить прибытие к партнёру"],
    ["picked_up", "Подтвердить получение заказа"],
    ["courier_to_client", "Выехать к клиенту"],
    ["arrived_at_client", "Подтвердить прибытие к клиенту"],
    ["delivered", "Завершить доставку"]
  ];

  for (const [status, label] of transitions) {
    await courierPage.getByRole("button", { name: label, exact: true }).click();
    await courierPage.getByRole("status").filter({ hasText: `Статус доставки подтверждён сервером: ${status}.` }).waitFor({ timeout: 15000 });
    assertEqual(queryDbScalar(`select status from public.deliveries where id=${sqlLiteral(deliveryId)}::uuid`, `delivery state ${status}`), status, `Courier browser transition ${status}`);
    assertEqual(queryDbScalar(`select count(*)::text from public.delivery_status_history where delivery_id=${sqlLiteral(deliveryId)}::uuid and to_status=${sqlLiteral(status)} and changed_by=${sqlLiteral(courierId)}::uuid and reason='courier_ui_progression'`, `history ${status}`), "1", `Courier history ${status}`);
    assertEqual(queryDbScalar(`select payment_status from public.orders where id=${sqlLiteral(orderId)}::uuid`, `payment invariant ${status}`), "pending", `Payment truth unchanged at ${status}`);
  }

  assertEqual(queryDbScalar(`select status from public.orders where id=${sqlLiteral(orderId)}::uuid`, "terminal order status"), "completed", "Delivered order projection");
  assertEqual(queryDbScalar(`select count(*)::text from public.courier_assignments where delivery_id=${sqlLiteral(deliveryId)}::uuid and status in ('assigned','accepted','in_progress')`, "terminal assignment count"), "0", "Terminal delivery has no active assignment");
  assertEqual(queryDbScalar(`select availability_status from public.courier_profiles where user_id=${sqlLiteral(courierId)}::uuid`, "terminal courier availability"), "online", "Courier returns online after delivery");
  await courierPage.getByText("Нет активного назначения", { exact: true }).waitFor({ timeout: 10000 });
  console.log("Courier browser full lifecycle + DB/history/payment invariants: PASS");
  await courierContext.close();
} finally {
  await browser.close();
}

console.log("KÖL local Admin→Courier operational browser runtime: PASS");

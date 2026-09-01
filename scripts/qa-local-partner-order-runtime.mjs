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
  throw new Error("Local Partner order QA requires local Supabase credentials, database URL and application URL.");
}

function assertLocalUrl(value, label) {
  const url = new URL(value);
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new Error(`Refusing ${label} against non-local host: ${url.hostname}`);
  }
}
assertLocalUrl(supabaseUrl, "Partner order Auth fixtures");
assertLocalUrl(localDbUrl, "Partner order database fixtures");
assertLocalUrl(appBaseUrl, "Partner order browser runtime");

const PASSWORD = "KolOrder!2026";
const RUN_SUFFIX = String(process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT || "1"}` : `${Date.now()}-${process.pid}`).replace(/[^a-zA-Z0-9-]/g, "-");
const specs = {
  partnerA: { email: `qa-order-partner-a-${RUN_SUFFIX}@kol.test`, role: "partner_owner" },
  partnerB: { email: `qa-order-partner-b-${RUN_SUFFIX}@kol.test`, role: "partner_owner" },
  client: { email: `qa-order-client-${RUN_SUFFIX}@kol.test`, role: "client" }
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
function execDb(sql) {
  execFileSync("psql", [localDbUrl, "-X", "-v", "ON_ERROR_STOP=1", "-q"], {
    input: sql,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"]
  });
}
function assertEqual(actual, expected, label) {
  if (String(actual) !== String(expected)) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function assertTrue(condition, label) {
  if (!condition) throw new Error(`${label}: expected true`);
}

async function createAuthUser(key) {
  const spec = specs[key];
  const payload = await authAdminRequest("/users", {
    method: "POST",
    body: {
      email: spec.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: `Partner order QA ${key}`, local_partner_order_qa: true }
    }
  });
  const user = payload?.user || payload;
  if (!user?.id) throw new Error(`Partner order QA ${key} user returned no id`);
  return user.id;
}

const partnerAId = await createAuthUser("partnerA");
const partnerBId = await createAuthUser("partnerB");
const clientId = await createAuthUser("client");
const businessA = queryDbScalar("select gen_random_uuid()::text", "business A id");
const businessB = queryDbScalar("select gen_random_uuid()::text", "business B id");
const menuItemId = queryDbScalar("select gen_random_uuid()::text", "menu item id");
const productId = queryDbScalar("select gen_random_uuid()::text", "product id");

execDb(`begin;
insert into public.user_profiles (user_id,full_name,email,locale,status) values
  (${sqlLiteral(partnerAId)}::uuid,'QA Order Partner A',${sqlLiteral(specs.partnerA.email)},'ru','active'),
  (${sqlLiteral(partnerBId)}::uuid,'QA Order Partner B',${sqlLiteral(specs.partnerB.email)},'ru','active'),
  (${sqlLiteral(clientId)}::uuid,'QA Order Client',${sqlLiteral(specs.client.email)},'ru','active');
insert into public.partners (id,owner_user_id,type,title,slug,description,location,address,phone,status,business_status,rating) values
  (${sqlLiteral(businessA)}::uuid,${sqlLiteral(partnerAId)}::uuid,'restaurant','QA Партнёр A',${sqlLiteral(`qa-order-a-${RUN_SUFFIX}`)},'Isolated Food/Shop QA business','Cholpon-Ata','QA pickup A','+996700001001','approved','online',5.0),
  (${sqlLiteral(businessB)}::uuid,${sqlLiteral(partnerBId)}::uuid,'shop','QA Order Partner B',${sqlLiteral(`qa-order-b-${RUN_SUFFIX}`)},'Cross-owner QA business','Bosteri','QA pickup B','+996700001002','approved','online',5.0);
insert into public.user_roles (user_id,role,scope_id,is_active) values
  (${sqlLiteral(partnerAId)}::uuid,'partner_owner',${sqlLiteral(businessA)}::uuid,true),
  (${sqlLiteral(partnerBId)}::uuid,'partner_owner',${sqlLiteral(businessB)}::uuid,true),
  (${sqlLiteral(clientId)}::uuid,'client',null,true);
insert into public.partner_profiles (user_id,business_id,position) values
  (${sqlLiteral(partnerAId)}::uuid,${sqlLiteral(businessA)}::uuid,'QA owner A'),
  (${sqlLiteral(partnerBId)}::uuid,${sqlLiteral(businessB)}::uuid,'QA owner B');
insert into public.client_profiles (user_id,default_address) values (${sqlLiteral(clientId)}::uuid,'QA pickup client');
insert into public.partner_staff (business_id,user_id,role,is_active) values
  (${sqlLiteral(businessA)}::uuid,${sqlLiteral(partnerAId)}::uuid,'partner_owner',true),
  (${sqlLiteral(businessB)}::uuid,${sqlLiteral(partnerBId)}::uuid,'partner_owner',true);
insert into public.restaurants (business_id,delivery_enabled,min_order_amount) values (${sqlLiteral(businessA)}::uuid,false,0);
insert into public.shops (business_id,delivery_enabled) values (${sqlLiteral(businessA)}::uuid,false);
insert into public.menu_items (id,business_id,title,description,price,preparation_time_minutes,status) values
  (${sqlLiteral(menuItemId)}::uuid,${sqlLiteral(businessA)}::uuid,'QA Блюдо','DB authoritative food item',750,15,'active');
insert into public.products (id,business_id,title,description,price,stock_qty,status) values
  (${sqlLiteral(productId)}::uuid,${sqlLiteral(businessA)}::uuid,'QA Товар','DB authoritative shop product',900,20,'active');
commit;`);

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

const clientApi = await signInClient("client");
const partnerApi = await signInClient("partnerA");
const partnerBApi = await signInClient("partnerB");

const { error: directUpdateError } = await partnerApi.from("orders").update({ status: "completed" }).eq("business_id", businessA);
if (!directUpdateError) throw new Error("Authenticated Partner direct orders UPDATE unexpectedly succeeded");
console.log("Partner direct order DML fail-closed: PASS");

const { error: legacyRpcError } = await partnerApi.rpc("mark_order_ready_for_pickup_atomic", { p_order_id: cryptoRandomUuidFallback() });
if (!legacyRpcError) throw new Error("Legacy ready_for_pickup RPC unexpectedly remained executable");
console.log("Legacy public Partner write entrypoint disabled: PASS");

function cryptoRandomUuidFallback() {
  return queryDbScalar("select gen_random_uuid()::text", "random uuid");
}

async function createDirectOrder(type, itemId, qty, key) {
  const { data, error } = await clientApi.rpc("create_order_atomic", {
    p_business_id: businessA,
    p_order_type: type,
    p_items: [{ item_id: itemId, qty }],
    p_delivery_method: "pickup",
    p_idempotency_key: key
  });
  if (error || typeof data !== "string") throw new Error(`Direct ${type} fixture creation failed: ${error?.message || "no order id"}`);
  return data;
}

const foodRejectId = await createDirectOrder("food", menuItemId, 1, `food-reject-${RUN_SUFFIX}`);
const shopRejectId = await createDirectOrder("shop", productId, 1, `shop-reject-${RUN_SUFFIX}`);
const invalidTransitionId = await createDirectOrder("food", menuItemId, 1, `invalid-transition-${RUN_SUFFIX}`);

const { error: wrongRoleError } = await clientApi.rpc("partner_order_action_atomic", {
  p_order_id: foodRejectId,
  p_action: "accept",
  p_request_id: `wrong-role-${RUN_SUFFIX}`,
  p_reason: null
});
if (!wrongRoleError) throw new Error("Client unexpectedly executed Partner order action");
const { error: crossOwnerError } = await partnerBApi.rpc("partner_order_action_atomic", {
  p_order_id: foodRejectId,
  p_action: "accept",
  p_request_id: `cross-owner-${RUN_SUFFIX}`,
  p_reason: null
});
if (!crossOwnerError) throw new Error("Cross-owner Partner unexpectedly executed Partner A order action");
assertEqual(queryDbScalar(`select status from public.orders where id=${sqlLiteral(foodRejectId)}::uuid`), "new", "Wrong-role/cross-owner order unchanged");
console.log("Partner order wrong-role + cross-owner denial: PASS");

const invalidHistoryBefore = queryDbScalar(`select count(*) from public.order_status_history where order_id=${sqlLiteral(invalidTransitionId)}::uuid`);
const { error: invalidTransitionError } = await partnerApi.rpc("partner_order_action_atomic", {
  p_order_id: invalidTransitionId,
  p_action: "start_preparing",
  p_request_id: `invalid-transition-action-${RUN_SUFFIX}`,
  p_reason: null
});
if (!invalidTransitionError) throw new Error("new -> preparing transition unexpectedly succeeded");
assertEqual(queryDbScalar(`select status from public.orders where id=${sqlLiteral(invalidTransitionId)}::uuid`), "new", "Invalid transition order unchanged");
assertEqual(queryDbScalar(`select count(*) from public.order_status_history where order_id=${sqlLiteral(invalidTransitionId)}::uuid`), invalidHistoryBefore, "Invalid transition history unchanged");
console.log("Invalid Partner order transition fail-closed: PASS");

const stockBeforeRejectedShop = queryDbScalar(`select stock_qty from public.products where id=${sqlLiteral(productId)}::uuid`);
const { error: shopRejectError } = await partnerApi.rpc("partner_order_action_atomic", {
  p_order_id: shopRejectId,
  p_action: "reject",
  p_request_id: `shop-reject-action-${RUN_SUFFIX}`,
  p_reason: null
});
if (!shopRejectError) throw new Error("Shop rejection unexpectedly succeeded without restock contract");
assertEqual(queryDbScalar(`select status from public.orders where id=${sqlLiteral(shopRejectId)}::uuid`), "new", "Shop reject order unchanged");
assertEqual(queryDbScalar(`select stock_qty from public.products where id=${sqlLiteral(productId)}::uuid`), stockBeforeRejectedShop, "Shop reject stock unchanged");
console.log("Shop reject/restock fail-closed: PASS");

const browser = await chromium.launch({ headless: true });
const clientContext = await browser.newContext();
await clientContext.addInitScript(() => {
  const pendingCart = window.sessionStorage.getItem("kol-cart-qa-next");
  if (!pendingCart) return;
  window.localStorage.setItem("kol-cart-v1", pendingCart);
  window.sessionStorage.removeItem("kol-cart-qa-next");
});
const clientPage = await clientContext.newPage();

async function loginBrowser(page, key, nextPath) {
  const response = await page.goto(`${appBaseUrl}/login?next=${encodeURIComponent(nextPath)}`, { waitUntil: "domcontentloaded" });
  const emailInput = page.locator('input[name="email"]');
  const passwordInput = page.locator('input[name="password"]');
  try {
    await emailInput.waitFor({ timeout: 10000 });
    await passwordInput.waitFor({ timeout: 10000 });
  } catch (error) {
    const body = (await page.locator("body").innerText().catch(() => "<body unavailable>" )).slice(0, 1500);
    throw new Error(`Login form unavailable for ${key}: url=${page.url()} http=${response?.status() ?? "unknown"} body=${JSON.stringify(body)} cause=${error?.message || error}`);
  }
  await emailInput.fill(specs[key].email);
  await passwordInput.fill(PASSWORD);
  await Promise.all([
    page.waitForURL((url) => url.pathname === nextPath, { timeout: 15000 }),
    page.locator('button[type="submit"]').click()
  ]);
}

function cartPayload(item) {
  return JSON.stringify([item]);
}
async function setCart(page, item) {
  if (!page.url().startsWith(appBaseUrl)) {
    await page.goto(appBaseUrl, { waitUntil: "domcontentloaded" });
  }

  const payload = cartPayload(item);
  await page.evaluate((value) => window.sessionStorage.setItem("kol-cart-qa-next", value), payload);
  await page.goto(`${appBaseUrl}/cart`, { waitUntil: "domcontentloaded" });

  try {
    await page.getByText(item.title, { exact: true }).waitFor({ timeout: 10000 });
  } catch (error) {
    const stored = await page.evaluate(() => window.localStorage.getItem("kol-cart-v1")).catch(() => null);
    const pending = await page.evaluate(() => window.sessionStorage.getItem("kol-cart-qa-next")).catch(() => null);
    const body = (await page.locator("body").innerText().catch(() => "<body unavailable>")).slice(0, 1500);
    throw new Error(`Cart hydration failed for ${item.title}: stored=${JSON.stringify(stored)} pending=${JSON.stringify(pending)} body=${JSON.stringify(body)} cause=${error?.message || error}`);
  }

  const stored = await page.evaluate(() => window.localStorage.getItem("kol-cart-v1"));
  assertTrue(typeof stored === "string" && stored.includes(item.id), `Cart fixture persisted for ${item.title}`);
}
async function submitCheckout(page, expectedTitle) {
  await page.goto(`${appBaseUrl}/checkout`, { waitUntil: "networkidle" });
  await page.getByText(expectedTitle, { exact: true }).waitFor({ timeout: 10000 });
  const deliveryRadio = page.getByRole("radio", { name: /Доставка — пока недоступна/i });
  assertTrue(await deliveryRadio.isDisabled(), "Delivery checkout remains disabled");
  await Promise.all([
    page.waitForURL((url) => /^\/client\/orders\/[0-9a-f-]{36}$/i.test(url.pathname), { timeout: 20000 }),
    page.getByRole("button", { name: "Оформить самовывоз" }).click()
  ]);
  return new URL(page.url()).pathname.split("/").pop();
}

await setCart(clientPage, {
  id: menuItemId,
  itemType: "food",
  businessId: businessA,
  title: "QA Блюдо",
  partnerName: "QA Партнёр A",
  quantity: 2,
  price: 1,
  currency: "KGS",
  status: "active"
});
await loginBrowser(clientPage, "client", "/checkout");
const foodOrderId = await submitCheckout(clientPage, "QA Блюдо");
assertTrue(Boolean(foodOrderId), "Food browser checkout returned order id");
assertEqual(queryDbScalar(`select client_id::text from public.orders where id=${sqlLiteral(foodOrderId)}::uuid`), clientId, "Food checkout derives client identity");
assertEqual(queryDbScalar(`select business_id::text from public.orders where id=${sqlLiteral(foodOrderId)}::uuid`), businessA, "Food checkout business");
assertEqual(queryDbScalar(`select type from public.orders where id=${sqlLiteral(foodOrderId)}::uuid`), "food", "Food checkout type");
assertEqual(queryDbScalar(`select status from public.orders where id=${sqlLiteral(foodOrderId)}::uuid`), "new", "Food checkout initial status");
assertEqual(queryDbScalar(`select total::text from public.orders where id=${sqlLiteral(foodOrderId)}::uuid`), "1500.00", "Food DB authoritative total ignores browser price");
assertEqual(queryDbScalar(`select payment_status from public.orders where id=${sqlLiteral(foodOrderId)}::uuid`), "pending", "Food checkout payment truth");
assertEqual(queryDbScalar(`select qty::text || ':' || unit_price::text || ':' || total::text from public.order_items where order_id=${sqlLiteral(foodOrderId)}::uuid`), "2:750.00:1500.00", "Food item snapshot authority");
assertEqual(queryDbScalar(`select delivery_method from public.order_delivery where order_id=${sqlLiteral(foodOrderId)}::uuid`), "pickup", "Food checkout pickup method");
assertEqual(queryDbScalar(`select count(*) from public.deliveries where order_id=${sqlLiteral(foodOrderId)}::uuid`), "0", "Food pickup creates no delivery row");
console.log("Client Food browser checkout + DB authority: PASS");

await setCart(clientPage, {
  id: productId,
  itemType: "product",
  businessId: businessA,
  title: "QA Товар",
  partnerName: "QA Партнёр A",
  quantity: 2,
  price: 1,
  currency: "KGS",
  status: "active"
});
await clientPage.goto(`${appBaseUrl}/checkout`, { waitUntil: "networkidle" });
const shopOrderId = await submitCheckout(clientPage, "QA Товар");
assertTrue(Boolean(shopOrderId), "Shop browser checkout returned order id");
assertEqual(queryDbScalar(`select type from public.orders where id=${sqlLiteral(shopOrderId)}::uuid`), "shop", "Shop checkout type");
assertEqual(queryDbScalar(`select total::text from public.orders where id=${sqlLiteral(shopOrderId)}::uuid`), "1800.00", "Shop DB authoritative total ignores browser price");
assertEqual(queryDbScalar(`select payment_status from public.orders where id=${sqlLiteral(shopOrderId)}::uuid`), "pending", "Shop checkout payment truth");
assertEqual(queryDbScalar(`select qty::text || ':' || unit_price::text || ':' || total::text from public.order_items where order_id=${sqlLiteral(shopOrderId)}::uuid`), "2:900.00:1800.00", "Shop item snapshot authority");
assertEqual(queryDbScalar(`select delivery_method from public.order_delivery where order_id=${sqlLiteral(shopOrderId)}::uuid`), "pickup", "Shop checkout pickup method");
assertEqual(queryDbScalar(`select count(*) from public.deliveries where order_id=${sqlLiteral(shopOrderId)}::uuid`), "0", "Shop pickup creates no delivery row");
console.log("Client Shop browser checkout + stock/order DB authority: PASS");

const partnerContext = await browser.newContext();
const partnerPage = await partnerContext.newPage();
await loginBrowser(partnerPage, "partnerA", "/partner/orders");

async function clickPartnerAction(orderId, label, expectedAction, expectedStatus) {
  await partnerPage.goto(`${appBaseUrl}/partner/orders/${orderId}`, { waitUntil: "networkidle" });
  await Promise.all([
    partnerPage.waitForURL((url) => url.pathname === `/partner/orders/${orderId}` && url.searchParams.get("partnerAction") === "success" && url.searchParams.get("action") === expectedAction, { timeout: 15000 }),
    partnerPage.getByRole("button", { name: label }).click()
  ]);
  await partnerPage.getByRole("status").waitFor({ timeout: 10000 });
  assertEqual(queryDbScalar(`select status from public.orders where id=${sqlLiteral(orderId)}::uuid`), expectedStatus, `${expectedAction} order status`);
  assertEqual(queryDbScalar(`select payment_status from public.orders where id=${sqlLiteral(orderId)}::uuid`), "pending", `${expectedAction} preserves payment`);
  assertEqual(queryDbScalar(`select changed_by::text from public.order_status_history where order_id=${sqlLiteral(orderId)}::uuid and to_status=${sqlLiteral(expectedStatus)} order by created_at desc limit 1`), partnerAId, `${expectedAction} history actor`);
  assertEqual(queryDbScalar(`select count(*) from public.audit_logs where entity_type='orders' and entity_id=${sqlLiteral(orderId)}::uuid and actor_id=${sqlLiteral(partnerAId)}::uuid and action=${sqlLiteral(`partner_order_${expectedAction}`)}`), "1", `${expectedAction} audit evidence`);
}

await partnerPage.goto(`${appBaseUrl}/partner/orders/${foodOrderId}`, { waitUntil: "networkidle" });
await partnerPage.getByText("QA Блюдо", { exact: true }).waitFor({ timeout: 10000 });
console.log("Partner scoped order item snapshot read: PASS");

await clickPartnerAction(foodOrderId, "Принять заказ", "accept", "accepted_by_partner");
const skippedReadyHistoryBefore = queryDbScalar(`select count(*) from public.order_status_history where order_id=${sqlLiteral(foodOrderId)}::uuid and to_status='ready_for_pickup'`);
const { error: skippedPreparationError } = await partnerApi.rpc("partner_order_action_atomic", {
  p_order_id: foodOrderId,
  p_action: "mark_ready",
  p_request_id: `skip-preparation-${RUN_SUFFIX}`,
  p_reason: null
});
if (!skippedPreparationError) throw new Error("accepted_by_partner -> ready_for_pickup unexpectedly bypassed preparation");
assertEqual(queryDbScalar(`select status from public.orders where id=${sqlLiteral(foodOrderId)}::uuid`), "accepted_by_partner", "Skipped preparation keeps accepted status");
assertEqual(queryDbScalar(`select count(*) from public.order_status_history where order_id=${sqlLiteral(foodOrderId)}::uuid and to_status='ready_for_pickup'`), skippedReadyHistoryBefore, "Skipped preparation writes no ready history");
console.log("Partner accepted→ready preparation bypass fail-closed: PASS");

await clickPartnerAction(foodOrderId, "Начать приготовление", "start_preparing", "preparing");
await clickPartnerAction(foodOrderId, "Готов к выдаче", "mark_ready", "ready_for_pickup");
assertEqual(queryDbScalar(`select count(*) from public.deliveries where order_id=${sqlLiteral(foodOrderId)}::uuid`), "0", "Partner lifecycle does not invent delivery");
console.log("Food Partner browser lifecycle + DB/history/payment invariants: PASS");

await clickPartnerAction(shopOrderId, "Принять заказ", "accept", "accepted_by_partner");
await clickPartnerAction(shopOrderId, "Начать приготовление", "start_preparing", "preparing");
await clickPartnerAction(shopOrderId, "Готов к выдаче", "mark_ready", "ready_for_pickup");
assertEqual(queryDbScalar(`select count(*) from public.deliveries where order_id=${sqlLiteral(shopOrderId)}::uuid`), "0", "Shop Partner lifecycle does not invent delivery");
console.log("Shop Partner browser lifecycle + DB/history/payment invariants: PASS");

await partnerPage.goto(`${appBaseUrl}/partner/orders/${foodOrderId}`, { waitUntil: "networkidle" });
await Promise.all([
  partnerPage.waitForURL((url) => url.searchParams.get("partnerAction") === "success" && url.searchParams.get("action") === "report_issue", { timeout: 15000 }),
  partnerPage.getByRole("button", { name: "Сообщить проблему" }).click()
]);
assertEqual(queryDbScalar(`select status || ':' || payment_status from public.orders where id=${sqlLiteral(foodOrderId)}::uuid`), "ready_for_pickup:pending", "Issue report preserves order/payment");
assertEqual(queryDbScalar(`select count(*) from public.audit_logs where entity_id=${sqlLiteral(foodOrderId)}::uuid and action='partner_order_issue_reported' and actor_id=${sqlLiteral(partnerAId)}::uuid`), "1", "Issue report audit");

await partnerPage.goto(`${appBaseUrl}/partner/orders/${foodOrderId}`, { waitUntil: "networkidle" });
await Promise.all([
  partnerPage.waitForURL((url) => url.searchParams.get("partnerAction") === "success" && url.searchParams.get("action") === "request_cancellation", { timeout: 15000 }),
  partnerPage.getByRole("button", { name: "Запросить отмену" }).click()
]);
assertEqual(queryDbScalar(`select status || ':' || payment_status from public.orders where id=${sqlLiteral(foodOrderId)}::uuid`), "ready_for_pickup:pending", "Cancellation request preserves order/payment");
assertEqual(queryDbScalar(`select count(*) from public.audit_logs where entity_id=${sqlLiteral(foodOrderId)}::uuid and action='partner_order_cancellation_requested' and actor_id=${sqlLiteral(partnerAId)}::uuid`), "1", "Cancellation request audit");
console.log("Partner issue/cancellation request audit-only invariants: PASS");

await partnerPage.goto(`${appBaseUrl}/partner/orders/${foodRejectId}`, { waitUntil: "networkidle" });
await Promise.all([
  partnerPage.waitForURL((url) => url.searchParams.get("partnerAction") === "success" && url.searchParams.get("action") === "reject", { timeout: 15000 }),
  partnerPage.getByRole("button", { name: "Отклонить заказ" }).click()
]);
assertEqual(queryDbScalar(`select status || ':' || payment_status from public.orders where id=${sqlLiteral(foodRejectId)}::uuid`), "rejected:pending", "Food reject status/payment");
console.log("Food Partner browser reject fail-safe payment invariant: PASS");

await partnerPage.goto(`${appBaseUrl}/partner/orders/${shopRejectId}`, { waitUntil: "networkidle" });
assertEqual(await partnerPage.getByRole("button", { name: "Отклонить заказ" }).count(), 0, "Shop reject button absent");
await partnerPage.getByText(/atomic restock contract/i).waitFor({ timeout: 10000 });
console.log("Shop reject UI fail-closed: PASS");

const historyBeforeReplay = queryDbScalar(`select count(*) from public.order_status_history where order_id=${sqlLiteral(foodOrderId)}::uuid and to_status='ready_for_pickup'`);
const { data: replayData, error: replayError } = await partnerApi.rpc("partner_order_action_atomic", {
  p_order_id: foodOrderId,
  p_action: "mark_ready",
  p_request_id: `ready-replay-${RUN_SUFFIX}`,
  p_reason: null
});
if (replayError || replayData?.idempotent !== true) throw new Error(`Committed mark_ready replay was not idempotent: ${replayError?.message || JSON.stringify(replayData)}`);
assertEqual(queryDbScalar(`select count(*) from public.order_status_history where order_id=${sqlLiteral(foodOrderId)}::uuid and to_status='ready_for_pickup'`), historyBeforeReplay, "Ready replay history unchanged");
console.log("Partner order committed transition idempotency: PASS");

await clientApi.auth.signOut({ scope: "local" });
await partnerApi.auth.signOut({ scope: "local" });
await partnerBApi.auth.signOut({ scope: "local" });
await clientContext.close();
await partnerContext.close();
await browser.close();

console.log("KÖL local Client→Partner Food/Shop operational browser runtime: PASS");

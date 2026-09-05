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
  throw new Error("Local Partner catalog write QA requires local Supabase credentials, database URL and application URL.");
}

function assertLocalUrl(value, label) {
  const url = new URL(value);
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new Error(`Refusing ${label} against non-local host: ${url.hostname}`);
  }
}
assertLocalUrl(supabaseUrl, "Partner catalog Auth fixtures");
assertLocalUrl(localDbUrl, "Partner catalog database fixtures");
assertLocalUrl(appBaseUrl, "Partner catalog browser runtime");

const PASSWORD = "KolCatalogWrite!2026";
const RUN_SUFFIX = String(
  process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT || "1"}`
    : `${Date.now()}-${process.pid}`
).replace(/[^a-zA-Z0-9-]/g, "-");
const specs = {
  ownerA: { email: `qa-catalog-owner-a-${RUN_SUFFIX}@kol.test`, role: "partner_owner" },
  ownerB: { email: `qa-catalog-owner-b-${RUN_SUFFIX}@kol.test`, role: "partner_owner" },
  staffA: { email: `qa-catalog-staff-a-${RUN_SUFFIX}@kol.test`, role: "partner_staff" },
  client: { email: `qa-catalog-client-${RUN_SUFFIX}@kol.test`, role: "client" }
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
  if (text) { try { payload = JSON.parse(text); } catch { payload = null; } }
  if (!response.ok) throw new Error(`Local GoTrue Admin ${method} ${path} failed with HTTP ${response.status}`);
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
function assertTrue(condition, label) { if (!condition) throw new Error(`${label}: expected true`); }

async function createAuthUser(key) {
  const spec = specs[key];
  const payload = await authAdminRequest("/users", {
    method: "POST",
    body: {
      email: spec.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: `Partner catalog write QA ${key}`, local_partner_catalog_write_qa: true }
    }
  });
  const user = payload?.user || payload;
  if (!user?.id) throw new Error(`Partner catalog write QA ${key} user returned no id`);
  return user.id;
}

const ownerAId = await createAuthUser("ownerA");
const ownerBId = await createAuthUser("ownerB");
const staffAId = await createAuthUser("staffA");
const clientId = await createAuthUser("client");
const businessA = queryDbScalar("select gen_random_uuid()::text", "business A id");
const businessB = queryDbScalar("select gen_random_uuid()::text", "business B id");
const categoryFood = queryDbScalar("select gen_random_uuid()::text", "food category id");
const categoryTour = queryDbScalar("select gen_random_uuid()::text", "tour category id");
const categoryStay = queryDbScalar("select gen_random_uuid()::text", "stay category id");
const categoryShop = queryDbScalar("select gen_random_uuid()::text", "shop category id");
const rejectedProduct = queryDbScalar("select gen_random_uuid()::text", "rejected product id");

execDb(`begin;
insert into public.user_profiles (user_id,full_name,email,locale,status) values
  (${sqlLiteral(ownerAId)}::uuid,'QA Catalog Owner A',${sqlLiteral(specs.ownerA.email)},'ru','active'),
  (${sqlLiteral(ownerBId)}::uuid,'QA Catalog Owner B',${sqlLiteral(specs.ownerB.email)},'ru','active'),
  (${sqlLiteral(staffAId)}::uuid,'QA Catalog Staff A',${sqlLiteral(specs.staffA.email)},'ru','active'),
  (${sqlLiteral(clientId)}::uuid,'QA Catalog Client',${sqlLiteral(specs.client.email)},'ru','active');
insert into public.partners (id,owner_user_id,type,title,slug,description,location,status,business_status,rating) values
  (${sqlLiteral(businessA)}::uuid,${sqlLiteral(ownerAId)}::uuid,'marketplace','QA Catalog A',${sqlLiteral(`qa-catalog-a-${RUN_SUFFIX}`)},'Partner catalog write QA','Cholpon-Ata','approved','online',5.0),
  (${sqlLiteral(businessB)}::uuid,${sqlLiteral(ownerBId)}::uuid,'marketplace','QA Catalog B',${sqlLiteral(`qa-catalog-b-${RUN_SUFFIX}`)},'Cross-owner catalog QA','Bosteri','approved','online',5.0);
insert into public.user_roles (user_id,role,scope_id,is_active) values
  (${sqlLiteral(ownerAId)}::uuid,'partner_owner',${sqlLiteral(businessA)}::uuid,true),
  (${sqlLiteral(ownerBId)}::uuid,'partner_owner',${sqlLiteral(businessB)}::uuid,true),
  (${sqlLiteral(staffAId)}::uuid,'partner_staff',${sqlLiteral(businessA)}::uuid,true),
  (${sqlLiteral(clientId)}::uuid,'client',null,true);
insert into public.partner_profiles (user_id,business_id,position) values
  (${sqlLiteral(ownerAId)}::uuid,${sqlLiteral(businessA)}::uuid,'QA owner A'),
  (${sqlLiteral(ownerBId)}::uuid,${sqlLiteral(businessB)}::uuid,'QA owner B'),
  (${sqlLiteral(staffAId)}::uuid,${sqlLiteral(businessA)}::uuid,'QA staff A');
insert into public.partner_staff (business_id,user_id,role,is_active) values
  (${sqlLiteral(businessA)}::uuid,${sqlLiteral(ownerAId)}::uuid,'partner_owner',true),
  (${sqlLiteral(businessB)}::uuid,${sqlLiteral(ownerBId)}::uuid,'partner_owner',true),
  (${sqlLiteral(businessA)}::uuid,${sqlLiteral(staffAId)}::uuid,'partner_staff',true);
insert into public.client_profiles (user_id,default_address) values (${sqlLiteral(clientId)}::uuid,'QA client');
insert into public.categories (id,scope,title,slug,sort_order) values
  (${sqlLiteral(categoryFood)}::uuid,'food','QA Food',${sqlLiteral(`qa-food-${RUN_SUFFIX}`)},9001),
  (${sqlLiteral(categoryTour)}::uuid,'tour','QA Tour',${sqlLiteral(`qa-tour-${RUN_SUFFIX}`)},9002),
  (${sqlLiteral(categoryStay)}::uuid,'stay','QA Stay',${sqlLiteral(`qa-stay-${RUN_SUFFIX}`)},9003),
  (${sqlLiteral(categoryShop)}::uuid,'shop','QA Shop',${sqlLiteral(`qa-shop-${RUN_SUFFIX}`)},9004);
insert into public.products (id,business_id,category_id,title,description,price,stock_qty,status,metadata) values
  (${sqlLiteral(rejectedProduct)}::uuid,${sqlLiteral(businessA)}::uuid,${sqlLiteral(categoryShop)}::uuid,'Rejected QA Product','Editable after rejection',500,3,'rejected','{}'::jsonb);
commit;`);

function createUserClient() {
  return createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
async function signInClient(key) {
  const client = createUserClient();
  const { error } = await client.auth.signInWithPassword({ email: specs[key].email, password: PASSWORD });
  if (error) throw error;
  return client;
}

const ownerAApi = await signInClient("ownerA");
const ownerBApi = await signInClient("ownerB");
const staffAApi = await signInClient("staffA");
const clientApi = await signInClient("client");

const { error: directInsertError } = await ownerAApi.from("menu_items").insert({
  business_id: businessA,
  category_id: categoryFood,
  title: "Direct insert must fail",
  price: 1,
  status: "active"
});
assertTrue(Boolean(directInsertError), "Direct authenticated catalog INSERT denied");
console.log("Partner catalog direct DML fail-closed: PASS");

const safeFoodFields = {
  title: "QA Lake Breakfast",
  description: "Safe food draft created by atomic partner authority",
  category_id: categoryFood,
  price: "780",
  slug: "",
  location: "",
  duration: "",
  type: "",
  preparation_time_minutes: "20",
  stock_qty: ""
};
for (const [label, api] of [["partner_staff", staffAApi], ["client", clientApi]]) {
  const { error } = await api.rpc("partner_catalog_write_atomic", {
    p_domain: "food", p_action: "create", p_item_id: null,
    p_request_id: `wrong-role-${label}-${RUN_SUFFIX}`, p_fields: safeFoodFields
  });
  assertTrue(Boolean(error), `${label} Partner catalog write denied`);
}
console.log("Partner catalog wrong-role write denial: PASS");

const createRequest = `food-create-${RUN_SUFFIX}`;
const { data: created, error: createError } = await ownerAApi.rpc("partner_catalog_write_atomic", {
  p_domain: "food", p_action: "create", p_item_id: null, p_request_id: createRequest, p_fields: safeFoodFields
});
if (createError || created?.ok !== true || created?.status !== "draft" || !created?.item_id) {
  throw new Error(`Partner food draft create failed: ${createError?.message || JSON.stringify(created)}`);
}
const foodId = created.item_id;
assertEqual(queryDbScalar(`select business_id::text from public.menu_items where id=${sqlLiteral(foodId)}::uuid`), businessA, "Created draft ownership");
assertEqual(queryDbScalar(`select status from public.menu_items where id=${sqlLiteral(foodId)}::uuid`), "draft", "Created draft status");
assertEqual(queryDbScalar(`select count(*) from public.audit_logs where actor_id=${sqlLiteral(ownerAId)}::uuid and request_id=${sqlLiteral(createRequest)}`), "1", "Create audit count");
console.log("Partner catalog draft create + ownership + audit: PASS");

const { data: replay, error: replayError } = await ownerAApi.rpc("partner_catalog_write_atomic", {
  p_domain: "food", p_action: "create", p_item_id: null, p_request_id: createRequest, p_fields: safeFoodFields
});
if (replayError || replay?.ok !== true || replay?.idempotent !== true || replay?.item_id !== foodId) throw new Error("Partner catalog exact replay failed");
assertEqual(queryDbScalar(`select count(*) from public.menu_items where id=${sqlLiteral(foodId)}::uuid`), "1", "Idempotent replay row count");
console.log("Partner catalog idempotent replay: PASS");

const { error: conflictError } = await ownerAApi.rpc("partner_catalog_write_atomic", {
  p_domain: "food", p_action: "create", p_item_id: null, p_request_id: createRequest,
  p_fields: { ...safeFoodFields, title: "Changed payload" }
});
assertTrue(Boolean(conflictError), "Request id payload conflict rejected");
console.log("Partner catalog request-id payload conflict: PASS");

const productFields = {
  title: "Updated QA Product", description: "Rejected item returned to draft", category_id: categoryShop,
  price: "650", slug: "", location: "", duration: "", type: "", preparation_time_minutes: "", stock_qty: "8"
};
const { data: productUpdate, error: productUpdateError } = await ownerAApi.rpc("partner_catalog_write_atomic", {
  p_domain: "products", p_action: "update", p_item_id: rejectedProduct,
  p_request_id: `product-update-${RUN_SUFFIX}`, p_fields: productFields
});
if (productUpdateError || productUpdate?.status !== "draft") throw new Error(`Rejected product update failed: ${productUpdateError?.message}`);
assertEqual(queryDbScalar(`select status||':'||stock_qty::text from public.products where id=${sqlLiteral(rejectedProduct)}::uuid`), "draft:8", "Rejected product -> draft update");
console.log("Partner catalog rejected -> draft edit: PASS");

const { error: crossOwnerError } = await ownerBApi.rpc("partner_catalog_write_atomic", {
  p_domain: "products", p_action: "update", p_item_id: rejectedProduct,
  p_request_id: `cross-owner-${RUN_SUFFIX}`, p_fields: productFields
});
assertTrue(Boolean(crossOwnerError), "Cross-business catalog update rejected");
console.log("Partner catalog cross-business write denial: PASS");

const { error: alcoholError } = await ownerAApi.rpc("partner_catalog_write_atomic", {
  p_domain: "products", p_action: "create", p_item_id: null,
  p_request_id: `alcohol-${RUN_SUFFIX}`,
  p_fields: { ...productFields, title: "QA Vodka Product" }
});
assertTrue(Boolean(alcoholError), "Alcohol-like catalog create rejected");
console.log("Partner catalog alcohol-like write fail-closed: PASS");

const submitRequest = `food-submit-${RUN_SUFFIX}`;
const { data: submitted, error: submitError } = await ownerAApi.rpc("partner_catalog_write_atomic", {
  p_domain: "food", p_action: "submit", p_item_id: foodId, p_request_id: submitRequest, p_fields: {}
});
if (submitError || submitted?.status !== "under_review") throw new Error(`Partner draft submit failed: ${submitError?.message}`);
assertEqual(queryDbScalar(`select status from public.menu_items where id=${sqlLiteral(foodId)}::uuid`), "under_review", "Draft submitted status");
assertEqual(queryDbScalar(`select count(*) from public.audit_logs where actor_id=${sqlLiteral(ownerAId)}::uuid and request_id=${sqlLiteral(submitRequest)}`), "1", "Submit audit count");
const { error: secondSubmitError } = await ownerAApi.rpc("partner_catalog_write_atomic", {
  p_domain: "food", p_action: "submit", p_item_id: foodId, p_request_id: `food-submit-again-${RUN_SUFFIX}`, p_fields: {}
});
assertTrue(Boolean(secondSubmitError), "Repeated transition from under_review rejected");
console.log("Partner catalog draft -> under_review + invalid transition denial: PASS");

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`${appBaseUrl}/login?next=/partner/catalog/food`);
  await page.locator('input[name="email"]').fill(specs.ownerA.email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Войти" }).click();
  await page.waitForURL(/\/partner\/catalog\/food/);
  const form = page.getByTestId("partner-catalog-create-form");
  await form.locator('select[name="categoryId"]').selectOption(categoryFood);
  await form.locator('input[name="title"]').fill("QA Browser Food Draft");
  await form.locator('input[name="price"]').fill("990");
  await form.locator('input[name="preparationTimeMinutes"]').fill("25");
  await form.locator('textarea[name="description"]').fill("Browser to server action to RPC to DB proof");
  await form.getByRole("button", { name: "Создать draft" }).click();
  await page.waitForURL(/partnerCatalogWrite=success/);
  assertEqual(queryDbScalar(`select count(*) from public.menu_items where business_id=${sqlLiteral(businessA)}::uuid and title='QA Browser Food Draft' and status='draft'`), "1", "Browser-created draft DB row");
  console.log("Partner browser form -> server action -> RPC -> DB: PASS");
} finally {
  await browser.close();
}

console.log("KÖL local Partner catalog write browser/DB runtime: PASS");

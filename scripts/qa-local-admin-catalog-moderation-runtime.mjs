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
  throw new Error("Local Admin catalog moderation QA requires local Supabase credentials, database URL and application URL.");
}

function assertLocalUrl(value, label) {
  const url = new URL(value);
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new Error(`Refusing ${label} against non-local host: ${url.hostname}`);
  }
}
assertLocalUrl(supabaseUrl, "Admin catalog Auth fixtures");
assertLocalUrl(localDbUrl, "Admin catalog database fixtures");
assertLocalUrl(appBaseUrl, "Admin catalog browser runtime");

const PASSWORD = "KolAdminCatalog!2026";
const RUN_SUFFIX = String(
  process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT || "1"}`
    : `${Date.now()}-${process.pid}`
).replace(/[^a-zA-Z0-9-]/g, "-");
const specs = {
  superAdmin: { email: `qa-catalog-super-${RUN_SUFFIX}@kol.test`, role: "super_admin" },
  supportAdmin: { email: `qa-catalog-support-${RUN_SUFFIX}@kol.test`, role: "support_admin" },
  client: { email: `qa-catalog-client-${RUN_SUFFIX}@kol.test`, role: "client" }
};

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
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
  if (String(actual) !== String(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
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
      user_metadata: { name: `Admin catalog QA ${key}`, local_admin_catalog_qa: true }
    }
  });
  const user = payload?.user || payload;
  if (!user?.id) throw new Error(`Admin catalog QA ${key} user returned no id`);
  return user.id;
}

const superAdminId = await createAuthUser("superAdmin");
const supportAdminId = await createAuthUser("supportAdmin");
const clientId = await createAuthUser("client");
const businessId = queryDbScalar("select gen_random_uuid()::text", "moderation business id");
const categoryId = queryDbScalar("select gen_random_uuid()::text", "moderation category id");
const safeProductId = queryDbScalar("select gen_random_uuid()::text", "safe product id");
const alcoholProductId = queryDbScalar("select gen_random_uuid()::text", "alcohol product id");
const tourId = queryDbScalar("select gen_random_uuid()::text", "tour id");
const alcoholTourId = queryDbScalar("select gen_random_uuid()::text", "alcohol tour id");

execDb(`begin;
insert into public.user_profiles (user_id,full_name,email,locale,status) values
  (${sqlLiteral(superAdminId)}::uuid,'QA Catalog Super Admin',${sqlLiteral(specs.superAdmin.email)},'ru','active'),
  (${sqlLiteral(supportAdminId)}::uuid,'QA Catalog Support Admin',${sqlLiteral(specs.supportAdmin.email)},'ru','active'),
  (${sqlLiteral(clientId)}::uuid,'QA Catalog Client',${sqlLiteral(specs.client.email)},'ru','active');
insert into public.user_roles (user_id,role,scope_id,is_active) values
  (${sqlLiteral(superAdminId)}::uuid,'super_admin',null,true),
  (${sqlLiteral(supportAdminId)}::uuid,'support_admin',null,true),
  (${sqlLiteral(clientId)}::uuid,'client',null,true);
insert into public.admin_profiles (user_id,admin_level,department) values
  (${sqlLiteral(superAdminId)}::uuid,'super_admin','QA Catalog'),
  (${sqlLiteral(supportAdminId)}::uuid,'support_admin','QA Support');
insert into public.client_profiles (user_id,default_address) values
  (${sqlLiteral(clientId)}::uuid,'QA client address');
insert into public.partners (id,owner_user_id,type,title,slug,description,location,status,business_status,rating) values
  (${sqlLiteral(businessId)}::uuid,null,'marketplace','QA Catalog Business',${sqlLiteral(`qa-catalog-${RUN_SUFFIX}`)},'Isolated moderation QA business','Cholpon-Ata','approved','online',5.0);
insert into public.categories (id,scope,title,slug,sort_order) values
  (${sqlLiteral(categoryId)}::uuid,'shop','QA Safe Catalog',${sqlLiteral(`qa-safe-${RUN_SUFFIX}`)},9000);
insert into public.products (id,business_id,category_id,title,description,price,stock_qty,status,metadata) values
  (${sqlLiteral(safeProductId)}::uuid,${sqlLiteral(businessId)}::uuid,${sqlLiteral(categoryId)}::uuid,'QA Safe Product','Safe moderation candidate',1200,12,'under_review','{}'::jsonb),
  (${sqlLiteral(alcoholProductId)}::uuid,${sqlLiteral(businessId)}::uuid,${sqlLiteral(categoryId)}::uuid,'QA Водка Product','Alcohol-like product must remain blocked',900,4,'under_review','{}'::jsonb);
insert into public.tours (id,business_id,category_id,title,slug,description,location,price,currency,duration,status,metadata) values
  (${sqlLiteral(tourId)}::uuid,${sqlLiteral(businessId)}::uuid,${sqlLiteral(categoryId)}::uuid,'QA Moderation Tour',${sqlLiteral(`qa-tour-${RUN_SUFFIX}`)},'Browser rejection candidate','Issyk-Kul',2500,'KGS','2h','under_review','{}'::jsonb),
  (${sqlLiteral(alcoholTourId)}::uuid,${sqlLiteral(businessId)}::uuid,${sqlLiteral(categoryId)}::uuid,'QA Beer Tour',${sqlLiteral(`qa-beer-tour-${RUN_SUFFIX}`)},'Cross-domain alcohol approval must remain blocked','Issyk-Kul',2600,'KGS','2h','under_review','{}'::jsonb);
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

const superAdminApi = await signInClient("superAdmin");
const supportAdminApi = await signInClient("supportAdmin");
const clientApi = await signInClient("client");

const { error: directDmlError } = await superAdminApi
  .from("products")
  .update({ status: "active" })
  .eq("id", safeProductId);
if (!directDmlError) throw new Error("Super-admin direct catalog UPDATE unexpectedly succeeded");
assertEqual(queryDbScalar(`select status from public.products where id=${sqlLiteral(safeProductId)}::uuid`), "under_review", "Direct DML leaves product unchanged");
console.log("Admin catalog direct authenticated DML fail-closed: PASS");

for (const [label, api] of [["support_admin", supportAdminApi], ["client", clientApi]]) {
  const { error } = await api.rpc("admin_catalog_moderation_atomic", {
    p_item_id: safeProductId,
    p_domain: "products",
    p_action: "approve",
    p_request_id: `wrong-role-${label}-${RUN_SUFFIX}`,
    p_reason: "Wrong role denial QA"
  });
  if (!error) throw new Error(`${label} unexpectedly executed Admin catalog moderation RPC`);
}
assertEqual(queryDbScalar(`select status from public.products where id=${sqlLiteral(safeProductId)}::uuid`), "under_review", "Wrong-role RPC leaves product unchanged");
console.log("Admin catalog support/client write denial: PASS");

const approveRequestId = `approve-safe-${RUN_SUFFIX}`;
const approveReason = "Safe catalog item approved by isolated QA";
const { data: approveData, error: approveError } = await superAdminApi.rpc("admin_catalog_moderation_atomic", {
  p_item_id: safeProductId,
  p_domain: "products",
  p_action: "approve",
  p_request_id: approveRequestId,
  p_reason: approveReason
});
if (approveError || approveData?.ok !== true || approveData?.status !== "approved") {
  throw new Error(`Safe product approval failed: ${approveError?.message || JSON.stringify(approveData)}`);
}
assertEqual(queryDbScalar(`select status from public.products where id=${sqlLiteral(safeProductId)}::uuid`), "approved", "Approved product DB status");
assertEqual(queryDbScalar(`select actor_id::text from public.audit_logs where entity_type='products' and entity_id=${sqlLiteral(safeProductId)}::uuid and action='admin_catalog_approve' and request_id=${sqlLiteral(approveRequestId)} limit 1`), superAdminId, "Approval audit actor");
assertEqual(queryDbScalar(`select reason from public.audit_logs where entity_type='products' and entity_id=${sqlLiteral(safeProductId)}::uuid and action='admin_catalog_approve' and request_id=${sqlLiteral(approveRequestId)} limit 1`), approveReason, "Approval audit reason");
assertEqual(queryDbScalar(`select count(*) from public.audit_logs where entity_type='products' and entity_id=${sqlLiteral(safeProductId)}::uuid and action='admin_catalog_approve' and request_id=${sqlLiteral(approveRequestId)}`), "1", "Approval audit exact count");

const anonCatalog = createUserClient();
const { data: publicApprovedRows, error: publicApprovedError } = await anonCatalog
  .from("products")
  .select("id")
  .eq("id", safeProductId);
if (publicApprovedError) throw publicApprovedError;
assertEqual(publicApprovedRows?.length ?? 0, 0, "Approved item is not public/published");
console.log("Super-admin approval + audit + non-public invariant: PASS");

const { data: replayData, error: replayError } = await superAdminApi.rpc("admin_catalog_moderation_atomic", {
  p_item_id: safeProductId,
  p_domain: "products",
  p_action: "approve",
  p_request_id: approveRequestId,
  p_reason: approveReason
});
if (replayError || replayData?.idempotent !== true) {
  throw new Error(`Admin moderation replay was not idempotent: ${replayError?.message || JSON.stringify(replayData)}`);
}
assertEqual(queryDbScalar(`select count(*) from public.audit_logs where entity_type='products' and entity_id=${sqlLiteral(safeProductId)}::uuid and action='admin_catalog_approve' and request_id=${sqlLiteral(approveRequestId)}`), "1", "Approval replay audit unchanged");
console.log("Admin catalog moderation idempotent replay: PASS");

const alcoholAuditBefore = queryDbScalar(`select count(*) from public.audit_logs where entity_type='products' and entity_id=${sqlLiteral(alcoholProductId)}::uuid`);
const { error: alcoholApproveError } = await superAdminApi.rpc("admin_catalog_moderation_atomic", {
  p_item_id: alcoholProductId,
  p_domain: "products",
  p_action: "approve",
  p_request_id: `approve-alcohol-${RUN_SUFFIX}`,
  p_reason: "This approval must be blocked by alcohol safety"
});
if (!alcoholApproveError) throw new Error("Alcohol-like product approval unexpectedly succeeded");
assertEqual(queryDbScalar(`select status from public.products where id=${sqlLiteral(alcoholProductId)}::uuid`), "under_review", "Alcohol product remains under review");
assertEqual(queryDbScalar(`select count(*) from public.audit_logs where entity_type='products' and entity_id=${sqlLiteral(alcoholProductId)}::uuid`), alcoholAuditBefore, "Blocked alcohol approval writes no moderation audit");
assertEqual(process.env.ALCOHOL_MODULE_ENABLED, "false", "Alcohol module remains disabled in runtime");
console.log("Alcohol catalog product approval fail-closed: PASS");

const alcoholTourAuditBefore = queryDbScalar(`select count(*) from public.audit_logs where entity_type='tours' and entity_id=${sqlLiteral(alcoholTourId)}::uuid`);
const { error: alcoholTourApproveError } = await superAdminApi.rpc("admin_catalog_moderation_atomic", {
  p_item_id: alcoholTourId,
  p_domain: "tours",
  p_action: "approve",
  p_request_id: `approve-alcohol-tour-${RUN_SUFFIX}`,
  p_reason: "Cross-domain alcohol approval must be blocked"
});
if (!alcoholTourApproveError) throw new Error("Alcohol-like tour approval unexpectedly succeeded");
assertEqual(queryDbScalar(`select status from public.tours where id=${sqlLiteral(alcoholTourId)}::uuid`), "under_review", "Alcohol tour remains under review");
assertEqual(queryDbScalar(`select count(*) from public.audit_logs where entity_type='tours' and entity_id=${sqlLiteral(alcoholTourId)}::uuid`), alcoholTourAuditBefore, "Blocked alcohol tour approval writes no moderation audit");
console.log("Alcohol catalog cross-domain approval fail-closed: PASS");

const invalidAuditBefore = queryDbScalar(`select count(*) from public.audit_logs where entity_type='products' and entity_id=${sqlLiteral(safeProductId)}::uuid`);
const { error: invalidTransitionError } = await superAdminApi.rpc("admin_catalog_moderation_atomic", {
  p_item_id: safeProductId,
  p_domain: "products",
  p_action: "reject",
  p_request_id: `invalid-transition-${RUN_SUFFIX}`,
  p_reason: "Approved item cannot be rejected by first-slice transition"
});
if (!invalidTransitionError) throw new Error("approved -> rejected first-slice transition unexpectedly succeeded");
assertEqual(queryDbScalar(`select status from public.products where id=${sqlLiteral(safeProductId)}::uuid`), "approved", "Invalid transition keeps approved status");
assertEqual(queryDbScalar(`select count(*) from public.audit_logs where entity_type='products' and entity_id=${sqlLiteral(safeProductId)}::uuid`), invalidAuditBefore, "Invalid transition writes no extra audit");
console.log("Invalid Admin catalog transition fail-closed: PASS");

const browser = await chromium.launch({ headless: true });

async function loginBrowser(page, key, nextPath) {
  const response = await page.goto(`${appBaseUrl}/login?next=${encodeURIComponent(nextPath)}`, { waitUntil: "domcontentloaded" });
  const emailInput = page.locator('input[name="email"]');
  const passwordInput = page.locator('input[name="password"]');
  try {
    await emailInput.waitFor({ timeout: 10000 });
    await passwordInput.waitFor({ timeout: 10000 });
  } catch (error) {
    const body = (await page.locator("body").innerText().catch(() => "<body unavailable>")).slice(0, 1500);
    throw new Error(`Admin catalog login form unavailable for ${key}: url=${page.url()} http=${response?.status() ?? "unknown"} body=${JSON.stringify(body)} cause=${error?.message || error}`);
  }
  await emailInput.fill(specs[key].email);
  await passwordInput.fill(PASSWORD);
  await Promise.all([
    page.waitForURL((url) => url.pathname === nextPath, { timeout: 15000 }),
    page.locator('button[type="submit"]').click()
  ]);
}

const superContext = await browser.newContext();
const superPage = await superContext.newPage();
await loginBrowser(superPage, "superAdmin", "/admin/catalog/review");
await superPage.getByText("QA Moderation Tour", { exact: true }).waitFor({ timeout: 10000 });
await superPage.getByText("QA Водка Product", { exact: true }).waitFor({ timeout: 10000 });
await superPage.getByText("QA Beer Tour", { exact: true }).waitFor({ timeout: 10000 });

for (const itemId of [alcoholProductId, alcoholTourId]) {
  const safetyApproveForm = superPage.locator(`form:has(input[name="itemId"][value="${itemId}"]):has(input[name="action"][value="approve"])`);
  assertEqual(await safetyApproveForm.count(), 0, "Alcohol/safety item has no Approve form");
  const safetyRejectForm = superPage.locator(`form:has(input[name="itemId"][value="${itemId}"]):has(input[name="action"][value="reject"])`);
  assertEqual(await safetyRejectForm.count(), 1, "Under-review alcohol/safety item keeps Reject form");
}
console.log("Admin catalog cross-domain safety UI approval block: PASS");

const rejectForm = superPage.locator(`form:has(input[name="itemId"][value="${tourId}"]):has(input[name="action"][value="reject"])`);
await rejectForm.waitFor({ timeout: 10000 });
const browserRequestId = await rejectForm.locator('input[name="requestId"]').inputValue();
const browserReason = "Browser QA rejected this moderation candidate";
await rejectForm.locator('input[name="reason"]').fill(browserReason);
await Promise.all([
  superPage.waitForURL((url) => url.pathname === "/admin/catalog/review" && url.searchParams.get("adminCatalogAction") === "success" && url.searchParams.get("action") === "reject", { timeout: 15000 }),
  rejectForm.getByRole("button", { name: "Reject" }).click()
]);
await superPage.getByRole("status").waitFor({ timeout: 10000 });
assertEqual(queryDbScalar(`select status from public.tours where id=${sqlLiteral(tourId)}::uuid`), "rejected", "Browser reject tour status");
assertEqual(queryDbScalar(`select actor_id::text from public.audit_logs where entity_type='tours' and entity_id=${sqlLiteral(tourId)}::uuid and action='admin_catalog_reject' and request_id=${sqlLiteral(browserRequestId)} limit 1`), superAdminId, "Browser reject audit actor");
assertEqual(queryDbScalar(`select reason from public.audit_logs where entity_type='tours' and entity_id=${sqlLiteral(tourId)}::uuid and action='admin_catalog_reject' and request_id=${sqlLiteral(browserRequestId)} limit 1`), browserReason, "Browser reject audit reason");
console.log("Super-admin browser moderation form -> RPC -> DB/audit: PASS");

const supportContext = await browser.newContext();
const supportPage = await supportContext.newPage();
await loginBrowser(supportPage, "supportAdmin", "/admin/catalog/review");
await supportPage.getByText("QA Водка Product", { exact: true }).waitFor({ timeout: 10000 });
assertEqual(await supportPage.locator('form input[name="itemId"]').count(), 0, "Support admin gets no moderation write forms");
await supportPage.locator('[data-testid="admin-catalog-read-only-notice"]').first().waitFor({ timeout: 10000 });
console.log("Support-admin moderation browser view remains read-only: PASS");

await superAdminApi.auth.signOut({ scope: "local" });
await supportAdminApi.auth.signOut({ scope: "local" });
await clientApi.auth.signOut({ scope: "local" });
await anonCatalog.auth.signOut({ scope: "local" }).catch(() => undefined);
await superContext.close();
await supportContext.close();
await browser.close();

console.log("KÖL local Admin catalog moderation browser/DB runtime: PASS");

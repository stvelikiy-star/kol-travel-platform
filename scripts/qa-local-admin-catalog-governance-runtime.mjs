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
  throw new Error("Local Admin catalog governance QA requires local Supabase credentials, database URL and application URL.");
}
function assertLocalUrl(value, label) {
  const url = new URL(value);
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new Error(`Refusing ${label} against non-local host: ${url.hostname}`);
  }
}
assertLocalUrl(supabaseUrl, "Admin governance Auth fixtures");
assertLocalUrl(localDbUrl, "Admin governance database fixtures");
assertLocalUrl(appBaseUrl, "Admin governance browser runtime");

const PASSWORD = "KolAdminGovernance!2026";
const RUN_SUFFIX = String(
  process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT || "1"}`
    : `${Date.now()}-${process.pid}`
).replace(/[^a-zA-Z0-9-]/g, "-");
const specs = {
  superAdmin: { email: `qa-governance-super-${RUN_SUFFIX}@kol.test`, role: "super_admin" },
  supportAdmin: { email: `qa-governance-support-${RUN_SUFFIX}@kol.test`, role: "support_admin" },
  client: { email: `qa-governance-client-${RUN_SUFFIX}@kol.test`, role: "client" }
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
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]
    }).trim();
  } catch (error) {
    const stderr = error?.stderr ? String(error.stderr).trim() : "";
    throw new Error(`${label}: ${stderr || error?.message || error}`);
  }
}
function execDb(sql) {
  execFileSync("psql", [localDbUrl, "-X", "-v", "ON_ERROR_STOP=1", "-q"], {
    input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"]
  });
}
function assertEqual(actual, expected, label) {
  if (String(actual) !== String(expected)) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

async function createAuthUser(key) {
  const spec = specs[key];
  const payload = await authAdminRequest("/users", {
    method: "POST",
    body: {
      email: spec.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: `Admin governance QA ${key}`, local_admin_governance_qa: true }
    }
  });
  const user = payload?.user || payload;
  if (!user?.id) throw new Error(`Admin governance QA ${key} user returned no id`);
  return user.id;
}

const superAdminId = await createAuthUser("superAdmin");
const supportAdminId = await createAuthUser("supportAdmin");
const clientId = await createAuthUser("client");
const businessId = queryDbScalar("select gen_random_uuid()::text", "business id");
const categoryId = queryDbScalar("select gen_random_uuid()::text", "category id");
const referencedCategoryId = queryDbScalar("select gen_random_uuid()::text", "referenced category id");
const standaloneCategoryId = queryDbScalar("select gen_random_uuid()::text", "standalone category id");
const safeProductId = queryDbScalar("select gen_random_uuid()::text", "safe product id");
const invalidProductId = queryDbScalar("select gen_random_uuid()::text", "invalid product id");
const alcoholProductId = queryDbScalar("select gen_random_uuid()::text", "alcohol product id");
const browserProductId = queryDbScalar("select gen_random_uuid()::text", "browser product id");
const referenceProductId = queryDbScalar("select gen_random_uuid()::text", "reference product id");

execDb(`begin;
insert into public.user_profiles (user_id,full_name,email,locale,status) values
  (${sqlLiteral(superAdminId)}::uuid,'QA Governance Super Admin',${sqlLiteral(specs.superAdmin.email)},'ru','active'),
  (${sqlLiteral(supportAdminId)}::uuid,'QA Governance Support Admin',${sqlLiteral(specs.supportAdmin.email)},'ru','active'),
  (${sqlLiteral(clientId)}::uuid,'QA Governance Client',${sqlLiteral(specs.client.email)},'ru','active');
insert into public.user_roles (user_id,role,scope_id,is_active) values
  (${sqlLiteral(superAdminId)}::uuid,'super_admin',null,true),
  (${sqlLiteral(supportAdminId)}::uuid,'support_admin',null,true),
  (${sqlLiteral(clientId)}::uuid,'client',null,true);
insert into public.admin_profiles (user_id,admin_level,department) values
  (${sqlLiteral(superAdminId)}::uuid,'super_admin','QA Governance'),
  (${sqlLiteral(supportAdminId)}::uuid,'support_admin','QA Support');
insert into public.client_profiles (user_id,default_address) values (${sqlLiteral(clientId)}::uuid,'QA address');
insert into public.partners (id,owner_user_id,type,title,slug,description,location,status,business_status,rating) values
  (${sqlLiteral(businessId)}::uuid,null,'marketplace','QA Governance Business',${sqlLiteral(`qa-governance-${RUN_SUFFIX}`)},'Isolated governance QA','Cholpon-Ata','approved','online',5.0);
insert into public.categories (id,scope,title,slug,sort_order,status) values
  (${sqlLiteral(categoryId)}::uuid,'shop','QA Governance Shop',${sqlLiteral(`qa-governance-shop-${RUN_SUFFIX}`)},9100,'active'),
  (${sqlLiteral(referencedCategoryId)}::uuid,'shop','QA Referenced Category',${sqlLiteral(`qa-reference-${RUN_SUFFIX}`)},9200,'active'),
  (${sqlLiteral(standaloneCategoryId)}::uuid,'shop','QA Standalone Category',${sqlLiteral(`qa-standalone-${RUN_SUFFIX}`)},9300,'active');
insert into public.products (id,business_id,category_id,title,description,price,stock_qty,status,metadata) values
  (${sqlLiteral(safeProductId)}::uuid,${sqlLiteral(businessId)}::uuid,${sqlLiteral(categoryId)}::uuid,'QA Governance Product','Safe approved product',1200,12,'approved','{}'::jsonb),
  (${sqlLiteral(invalidProductId)}::uuid,${sqlLiteral(businessId)}::uuid,${sqlLiteral(categoryId)}::uuid,'QA Under Review Product','Cannot publish directly',1100,5,'under_review','{}'::jsonb),
  (${sqlLiteral(alcoholProductId)}::uuid,${sqlLiteral(businessId)}::uuid,${sqlLiteral(categoryId)}::uuid,'QA Vodka Product','Alcohol publish must fail',900,4,'approved','{}'::jsonb),
  (${sqlLiteral(browserProductId)}::uuid,${sqlLiteral(businessId)}::uuid,${sqlLiteral(categoryId)}::uuid,'QA Browser Publish Product','Browser governance candidate',1400,8,'approved','{}'::jsonb),
  (${sqlLiteral(referenceProductId)}::uuid,${sqlLiteral(businessId)}::uuid,${sqlLiteral(referencedCategoryId)}::uuid,'QA Reference Product','Blocks category archive',500,2,'rejected','{}'::jsonb);
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
const superAdminApi = await signInClient("superAdmin");
const supportAdminApi = await signInClient("supportAdmin");
const clientApi = await signInClient("client");
const anonApi = createUserClient();

const { error: directProductError } = await superAdminApi.from("products").update({ status: "active" }).eq("id", safeProductId);
if (!directProductError) throw new Error("Direct product governance DML unexpectedly succeeded");
const { error: directCategoryError } = await superAdminApi.from("categories").update({ status: "archived" }).eq("id", standaloneCategoryId);
if (!directCategoryError) throw new Error("Direct category governance DML unexpectedly succeeded");
console.log("Admin governance direct DML fail-closed: PASS");

for (const [label, api] of [["support_admin", supportAdminApi], ["client", clientApi]]) {
  const { error: itemError } = await api.rpc("admin_catalog_governance_atomic", {
    p_item_id: safeProductId, p_domain: "products", p_action: "publish",
    p_request_id: `wrong-item-${label}-${RUN_SUFFIX}`, p_reason: "Wrong role denial QA"
  });
  if (!itemError) throw new Error(`${label} unexpectedly executed catalog governance RPC`);
  const { error: categoryError } = await api.rpc("admin_catalog_category_atomic", {
    p_category_id: null, p_action: "create", p_request_id: `wrong-cat-${label}-${RUN_SUFFIX}`,
    p_fields: { title: "Wrong Role", slug: `wrong-role-${label}-${RUN_SUFFIX.toLowerCase()}`, scope: "shop", parent_id: "", sort_order: "0" },
    p_reason: "Wrong role denial QA"
  });
  if (!categoryError) throw new Error(`${label} unexpectedly executed category governance RPC`);
}
console.log("Admin governance wrong-role denial: PASS");

const publishRequest = `publish-${RUN_SUFFIX}`;
const publishReason = "QA approved product publication";
const { data: publishData, error: publishError } = await superAdminApi.rpc("admin_catalog_governance_atomic", {
  p_item_id: safeProductId, p_domain: "products", p_action: "publish",
  p_request_id: publishRequest, p_reason: publishReason
});
if (publishError || publishData?.ok !== true || publishData?.status !== "active") {
  throw new Error(`Publish failed: ${publishError?.message || JSON.stringify(publishData)}`);
}
assertEqual(queryDbScalar(`select status from public.products where id=${sqlLiteral(safeProductId)}::uuid`), "active", "Published product status");
assertEqual(queryDbScalar(`select count(*) from public.audit_logs where entity_id=${sqlLiteral(safeProductId)}::uuid and action='admin_catalog_publish' and request_id=${sqlLiteral(publishRequest)}`), "1", "Publish audit count");
const { data: publicPublished, error: publicPublishedError } = await anonApi.from("products").select("id").eq("id", safeProductId);
if (publicPublishedError) throw publicPublishedError;
assertEqual(publicPublished?.length ?? 0, 1, "Published active product visible to anon");
console.log("Admin publish -> public active visibility + audit: PASS");

const { data: replayData, error: replayError } = await superAdminApi.rpc("admin_catalog_governance_atomic", {
  p_item_id: safeProductId, p_domain: "products", p_action: "publish",
  p_request_id: publishRequest, p_reason: publishReason
});
if (replayError || replayData?.idempotent !== true) throw new Error("Publish idempotent replay failed");
assertEqual(queryDbScalar(`select count(*) from public.audit_logs where entity_id=${sqlLiteral(safeProductId)}::uuid and request_id=${sqlLiteral(publishRequest)}`), "1", "Publish replay audit count");
console.log("Admin governance idempotent replay: PASS");

const { data: unpublishData, error: unpublishError } = await superAdminApi.rpc("admin_catalog_governance_atomic", {
  p_item_id: safeProductId, p_domain: "products", p_action: "unpublish",
  p_request_id: `unpublish-${RUN_SUFFIX}`, p_reason: "QA remove public visibility"
});
if (unpublishError || unpublishData?.status !== "approved") throw new Error(`Unpublish failed: ${unpublishError?.message || JSON.stringify(unpublishData)}`);
const { data: publicUnpublished } = await anonApi.from("products").select("id").eq("id", safeProductId);
assertEqual(publicUnpublished?.length ?? 0, 0, "Unpublished product hidden from anon");
console.log("Admin unpublish removes public visibility: PASS");

const { error: invalidPublishError } = await superAdminApi.rpc("admin_catalog_governance_atomic", {
  p_item_id: invalidProductId, p_domain: "products", p_action: "publish",
  p_request_id: `invalid-publish-${RUN_SUFFIX}`, p_reason: "Invalid transition QA"
});
if (!invalidPublishError) throw new Error("under_review -> active publish unexpectedly succeeded");
assertEqual(queryDbScalar(`select status from public.products where id=${sqlLiteral(invalidProductId)}::uuid`), "under_review", "Invalid publish leaves status");
console.log("Admin invalid publish transition fail-closed: PASS");

const { error: alcoholPublishError } = await superAdminApi.rpc("admin_catalog_governance_atomic", {
  p_item_id: alcoholProductId, p_domain: "products", p_action: "publish",
  p_request_id: `alcohol-publish-${RUN_SUFFIX}`, p_reason: "Alcohol publish must remain blocked"
});
if (!alcoholPublishError) throw new Error("Alcohol-like publish unexpectedly succeeded");
assertEqual(queryDbScalar(`select status from public.products where id=${sqlLiteral(alcoholProductId)}::uuid`), "approved", "Alcohol product stays approved/non-public");
console.log("Admin alcohol publish fail-closed: PASS");

const { data: archiveData, error: archiveError } = await superAdminApi.rpc("admin_catalog_governance_atomic", {
  p_item_id: safeProductId, p_domain: "products", p_action: "archive",
  p_request_id: `archive-item-${RUN_SUFFIX}`, p_reason: "QA archive controlled item"
});
if (archiveError || archiveData?.status !== "archived") throw new Error(`Catalog archive failed: ${archiveError?.message || JSON.stringify(archiveData)}`);
assertEqual(queryDbScalar(`select status from public.products where id=${sqlLiteral(safeProductId)}::uuid`), "archived", "Archived product status");
console.log("Admin catalog archive + audit authority: PASS");

const createCategoryRequest = `create-category-${RUN_SUFFIX}`;
const createdSlug = `qa-created-${RUN_SUFFIX.toLowerCase()}`;
const { data: createdCategory, error: createCategoryError } = await superAdminApi.rpc("admin_catalog_category_atomic", {
  p_category_id: null,
  p_action: "create",
  p_request_id: createCategoryRequest,
  p_fields: { title: "QA Created Category", slug: createdSlug, scope: "shop", parent_id: "", sort_order: "9400" },
  p_reason: "Create canonical QA category"
});
if (createCategoryError || createdCategory?.ok !== true || !createdCategory?.category_id) {
  throw new Error(`Category create failed: ${createCategoryError?.message || JSON.stringify(createdCategory)}`);
}
const createdCategoryId = createdCategory.category_id;
assertEqual(queryDbScalar(`select status from public.categories where id=${sqlLiteral(createdCategoryId)}::uuid`), "active", "Created category active");
const { data: publicCreatedCategory, error: publicCategoryError } = await anonApi.from("categories").select("id").eq("id", createdCategoryId);
if (publicCategoryError) throw publicCategoryError;
assertEqual(publicCreatedCategory?.length ?? 0, 1, "Created active category public");
console.log("Admin category create + public taxonomy visibility: PASS");

const { data: categoryReplay, error: categoryReplayError } = await superAdminApi.rpc("admin_catalog_category_atomic", {
  p_category_id: null,
  p_action: "create",
  p_request_id: createCategoryRequest,
  p_fields: { title: "QA Created Category", slug: createdSlug, scope: "shop", parent_id: "", sort_order: "9400" },
  p_reason: "Create canonical QA category"
});
if (categoryReplayError || categoryReplay?.idempotent !== true) throw new Error("Category create idempotent replay failed");
console.log("Admin category idempotent replay: PASS");

const { error: alcoholCategoryError } = await superAdminApi.rpc("admin_catalog_category_atomic", {
  p_category_id: null,
  p_action: "create",
  p_request_id: `alcohol-category-${RUN_SUFFIX}`,
  p_fields: { title: "Vodka", slug: `vodka-${RUN_SUFFIX.toLowerCase()}`, scope: "shop", parent_id: "", sort_order: "9500" },
  p_reason: "Alcohol category must remain blocked"
});
if (!alcoholCategoryError) throw new Error("Alcohol-like category creation unexpectedly succeeded");
console.log("Admin alcohol category fail-closed: PASS");

const { error: referencedArchiveError } = await superAdminApi.rpc("admin_catalog_category_atomic", {
  p_category_id: referencedCategoryId,
  p_action: "archive",
  p_request_id: `archive-referenced-${RUN_SUFFIX}`,
  p_fields: {},
  p_reason: "Referenced category archive must fail"
});
if (!referencedArchiveError) throw new Error("Referenced category archive unexpectedly succeeded");
assertEqual(queryDbScalar(`select status from public.categories where id=${sqlLiteral(referencedCategoryId)}::uuid`), "active", "Referenced category remains active");
console.log("Referenced category archive fail-closed: PASS");

const { data: standaloneArchive, error: standaloneArchiveError } = await superAdminApi.rpc("admin_catalog_category_atomic", {
  p_category_id: standaloneCategoryId,
  p_action: "archive",
  p_request_id: `archive-standalone-${RUN_SUFFIX}`,
  p_fields: {},
  p_reason: "Archive unused QA category"
});
if (standaloneArchiveError || standaloneArchive?.status !== "archived") throw new Error(`Standalone category archive failed: ${standaloneArchiveError?.message || JSON.stringify(standaloneArchive)}`);
const { data: publicArchivedCategory } = await anonApi.from("categories").select("id").eq("id", standaloneCategoryId);
assertEqual(publicArchivedCategory?.length ?? 0, 0, "Archived category hidden from anon");
console.log("Unused category archive removes public taxonomy visibility: PASS");

const browser = await chromium.launch({ headless: true });
async function loginBrowser(page, key, nextPath) {
  const response = await page.goto(`${appBaseUrl}/login?next=${encodeURIComponent(nextPath)}`, { waitUntil: "domcontentloaded" });
  const emailInput = page.locator('input[name="email"]');
  const passwordInput = page.locator('input[name="password"]');
  try {
    await emailInput.waitFor({ timeout: 10000 });
    await passwordInput.waitFor({ timeout: 10000 });
  } catch (error) {
    const body = (await page.locator("body").innerText().catch(() => "<body unavailable>")).slice(0, 1200);
    throw new Error(`Governance login unavailable for ${key}: url=${page.url()} http=${response?.status() ?? "unknown"} body=${JSON.stringify(body)} cause=${error?.message || error}`);
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
await loginBrowser(superPage, "superAdmin", "/admin/catalog/products");
await superPage.getByText("QA Browser Publish Product", { exact: true }).waitFor({ timeout: 10000 });
const publishForm = superPage.locator(`form:has(input[name="itemId"][value="${browserProductId}"]):has(input[name="action"][value="publish"])`);
await publishForm.waitFor({ timeout: 10000 });
const browserPublishRequest = await publishForm.locator('input[name="requestId"]').inputValue();
await publishForm.locator('input[name="reason"]').fill("Browser QA publish through server action");
await Promise.all([
  superPage.waitForURL((url) => url.pathname === "/admin/catalog/products" && url.searchParams.get("adminCatalogGovernance") === "success" && url.searchParams.get("action") === "publish", { timeout: 15000 }),
  publishForm.getByRole("button", { name: "Publish" }).click()
]);
assertEqual(queryDbScalar(`select status from public.products where id=${sqlLiteral(browserProductId)}::uuid`), "active", "Browser publish product status");
assertEqual(queryDbScalar(`select count(*) from public.audit_logs where entity_id=${sqlLiteral(browserProductId)}::uuid and action='admin_catalog_publish' and request_id=${sqlLiteral(browserPublishRequest)}`), "1", "Browser publish audit");
console.log("Super-admin browser publish -> server action -> RPC -> DB: PASS");

await superPage.goto(`${appBaseUrl}/admin/catalog/categories`, { waitUntil: "domcontentloaded" });
const createForm = superPage.getByTestId("admin-category-create-form");
await createForm.waitFor({ timeout: 10000 });
const browserCategorySlug = `browser-category-${RUN_SUFFIX.toLowerCase()}`;
await createForm.locator('input[name="title"]').fill("Browser QA Category");
await createForm.locator('input[name="slug"]').fill(browserCategorySlug);
await createForm.locator('select[name="scope"]').selectOption("shop");
await createForm.locator('input[name="sortOrder"]').fill("9600");
await createForm.locator('input[name="reason"]').fill("Browser QA category create");
await Promise.all([
  superPage.waitForURL((url) => url.pathname === "/admin/catalog/categories" && url.searchParams.get("adminCategoryAction") === "success" && url.searchParams.get("action") === "create", { timeout: 15000 }),
  createForm.getByRole("button", { name: "Create category" }).click()
]);
assertEqual(queryDbScalar(`select count(*) from public.categories where slug=${sqlLiteral(browserCategorySlug)} and status='active'`), "1", "Browser category create DB row");
console.log("Super-admin browser category create -> server action -> RPC -> DB: PASS");

const supportContext = await browser.newContext();
const supportPage = await supportContext.newPage();
await loginBrowser(supportPage, "supportAdmin", "/admin/catalog/products");
await supportPage.getByText("QA Browser Publish Product", { exact: true }).waitFor({ timeout: 10000 });
assertEqual(await supportPage.locator('[data-testid="admin-catalog-governance-actions"]').count(), 0, "Support admin has no governance action panel");
await supportPage.goto(`${appBaseUrl}/admin/catalog/categories`, { waitUntil: "domcontentloaded" });
assertEqual(await supportPage.getByTestId("admin-category-create-form").count(), 0, "Support admin has no category create form");
console.log("Support-admin governance browser remains read-only: PASS");

await superAdminApi.auth.signOut({ scope: "local" });
await supportAdminApi.auth.signOut({ scope: "local" });
await clientApi.auth.signOut({ scope: "local" });
await superContext.close();
await supportContext.close();
await browser.close();

console.log("KÖL local Admin catalog governance browser/RPC/DB runtime: PASS");

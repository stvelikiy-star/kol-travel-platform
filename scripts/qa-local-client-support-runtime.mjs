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
  throw new Error("Local Client Support QA requires local Supabase credentials, database URL and application URL.");
}

function assertLocalUrl(value, label) {
  const url = new URL(value);
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new Error(`Refusing ${label} against non-local host: ${url.hostname}`);
  }
}
assertLocalUrl(supabaseUrl, "Support Auth fixtures");
assertLocalUrl(localDbUrl, "Support database fixtures");
assertLocalUrl(appBaseUrl, "Support browser runtime");

const PASSWORD = "KolClientSupport!2026";
const RUN_SUFFIX = String(
  process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT || "1"}`
    : `${Date.now()}-${process.pid}`
).replace(/[^a-zA-Z0-9-]/g, "-");
const specs = {
  client: { email: `qa-support-client-${RUN_SUFFIX}@kol.test`, role: "client" },
  otherClient: { email: `qa-support-other-${RUN_SUFFIX}@kol.test`, role: "client" },
  admin: { email: `qa-support-admin-${RUN_SUFFIX}@kol.test`, role: "support_admin" }
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
  if (String(actual) !== String(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function createAuthUser(key) {
  const spec = specs[key];
  const payload = await authAdminRequest("/users", {
    method: "POST",
    body: {
      email: spec.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: `Client Support QA ${key}`, local_client_support_qa: true }
    }
  });
  const user = payload?.user || payload;
  if (!user?.id) throw new Error(`Client Support QA ${key} user returned no id`);
  return user.id;
}

const clientId = await createAuthUser("client");
const otherClientId = await createAuthUser("otherClient");
const adminId = await createAuthUser("admin");

execDb(`begin;
insert into public.user_profiles (user_id,full_name,email,locale,status) values
  (${sqlLiteral(clientId)}::uuid,'QA Support Client',${sqlLiteral(specs.client.email)},'ru','active'),
  (${sqlLiteral(otherClientId)}::uuid,'QA Support Other',${sqlLiteral(specs.otherClient.email)},'ru','active'),
  (${sqlLiteral(adminId)}::uuid,'QA Support Admin',${sqlLiteral(specs.admin.email)},'ru','active');
insert into public.user_roles (user_id,role,scope_id,is_active) values
  (${sqlLiteral(clientId)}::uuid,'client',null,true),
  (${sqlLiteral(otherClientId)}::uuid,'client',null,true),
  (${sqlLiteral(adminId)}::uuid,'support_admin',null,true);
insert into public.client_profiles (user_id,default_address) values
  (${sqlLiteral(clientId)}::uuid,'QA client address'),
  (${sqlLiteral(otherClientId)}::uuid,'QA other address');
insert into public.admin_profiles (user_id,admin_level,department) values
  (${sqlLiteral(adminId)}::uuid,'support_admin','Support QA');
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
const otherClientApi = await signInClient("otherClient");
const adminApi = await signInClient("admin");

const { error: directInsertError } = await clientApi.from("support_tickets").insert({
  created_by: clientId,
  category: "general",
  priority: "medium",
  status: "open",
  title: "Direct write must fail"
});
if (!directInsertError) throw new Error("Client direct support_tickets INSERT unexpectedly succeeded");
console.log("Client direct support DML fail-closed: PASS");

const requestId = `support-rpc-${RUN_SUFFIX}`;
const rpcArgs = {
  p_category: "technical",
  p_title: "QA RPC support ticket",
  p_message: "The isolated support runtime must create exactly one ticket and one first message.",
  p_request_id: requestId,
  p_related_order_id: null,
  p_related_booking_id: null
};
const { data: created, error: createError } = await clientApi.rpc("client_support_ticket_create_atomic", rpcArgs);
if (createError || created?.ok !== true || !created?.ticket_id) {
  throw new Error(`Support RPC creation failed: ${createError?.message || JSON.stringify(created)}`);
}
const ticketId = created.ticket_id;
assertEqual(queryDbScalar(`select created_by::text from public.support_tickets where id=${sqlLiteral(ticketId)}::uuid`), clientId, "Support ticket owner");
assertEqual(queryDbScalar(`select status from public.support_tickets where id=${sqlLiteral(ticketId)}::uuid`), "open", "Support ticket status");
assertEqual(queryDbScalar(`select priority from public.support_tickets where id=${sqlLiteral(ticketId)}::uuid`), "medium", "Support ticket priority");
assertEqual(queryDbScalar(`select count(*) from public.ticket_messages where ticket_id=${sqlLiteral(ticketId)}::uuid`), "1", "Support first message count");
assertEqual(queryDbScalar(`select sender_id::text from public.ticket_messages where ticket_id=${sqlLiteral(ticketId)}::uuid limit 1`), clientId, "Support first message sender");
assertEqual(queryDbScalar(`select count(*) from public.audit_logs where action='client_support_ticket_created' and entity_id=${sqlLiteral(ticketId)}::uuid and request_id=${sqlLiteral(requestId)}`), "1", "Support audit count");
console.log("Client support RPC -> ticket/message/audit: PASS");

const { data: replay, error: replayError } = await clientApi.rpc("client_support_ticket_create_atomic", rpcArgs);
if (replayError || replay?.ok !== true || replay?.ticket_id !== ticketId || replay?.idempotent !== true) {
  throw new Error(`Support RPC replay was not idempotent: ${replayError?.message || JSON.stringify(replay)}`);
}
assertEqual(queryDbScalar(`select count(*) from public.support_tickets where id=${sqlLiteral(ticketId)}::uuid`), "1", "Support replay ticket count");
assertEqual(queryDbScalar(`select count(*) from public.ticket_messages where ticket_id=${sqlLiteral(ticketId)}::uuid`), "1", "Support replay message count");
console.log("Client support idempotent replay: PASS");

const { error: payloadConflict } = await clientApi.rpc("client_support_ticket_create_atomic", {
  ...rpcArgs,
  p_message: "Changed payload must be rejected under the same request id."
});
if (!payloadConflict) throw new Error("Changed support payload unexpectedly reused request id");
console.log("Client support request-id payload conflict: PASS");

const { data: foreignRows, error: foreignReadError } = await otherClientApi
  .from("support_tickets")
  .select("id")
  .eq("id", ticketId);
if (foreignReadError) throw foreignReadError;
assertEqual(foreignRows?.length ?? 0, 0, "Other client cannot read support ticket");

const { data: adminRows, error: adminReadError } = await adminApi
  .from("support_tickets")
  .select("id")
  .eq("id", ticketId);
if (adminReadError) throw adminReadError;
assertEqual(adminRows?.length ?? 0, 1, "Support admin reads client ticket");
console.log("Support RLS owner/admin isolation: PASS");

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
    throw new Error(`Support login unavailable for ${key}: url=${page.url()} http=${response?.status() ?? "unknown"} body=${JSON.stringify(body)} cause=${error?.message || error}`);
  }
  await emailInput.fill(specs[key].email);
  await passwordInput.fill(PASSWORD);
  await Promise.all([
    page.waitForURL((url) => url.pathname === nextPath, { timeout: 15000 }),
    page.locator('button[type="submit"]').click()
  ]);
}

const clientContext = await browser.newContext();
const clientPage = await clientContext.newPage();
await loginBrowser(clientPage, "client", "/client/support");
await clientPage.getByText("Новое обращение", { exact: true }).waitFor({ timeout: 10000 });
const browserTitle = `Browser Support ${RUN_SUFFIX}`;
const browserMessage = "Browser support flow must create a real Supabase ticket visible to Admin.";
await clientPage.locator('select[name="category"]').selectOption("technical");
await clientPage.locator('input[name="title"]').fill(browserTitle);
await clientPage.locator('textarea[name="message"]').fill(browserMessage);
await Promise.all([
  clientPage.waitForURL((url) => url.pathname === "/client/support" && url.searchParams.get("support") === "created", { timeout: 15000 }),
  clientPage.getByRole("button", { name: "Отправить обращение" }).click()
]);
await clientPage.getByRole("status").waitFor({ timeout: 10000 });
const browserTicketId = queryDbScalar(`select id::text from public.support_tickets where created_by=${sqlLiteral(clientId)}::uuid and title=${sqlLiteral(browserTitle)} order by created_at desc limit 1`, "browser support ticket");
if (!browserTicketId) throw new Error("Browser support flow created no ticket");
assertEqual(queryDbScalar(`select count(*) from public.ticket_messages where ticket_id=${sqlLiteral(browserTicketId)}::uuid`), "1", "Browser support first message count");
console.log("Client browser support form -> server action -> RPC -> DB: PASS");

const adminContext = await browser.newContext();
const adminPage = await adminContext.newPage();
await loginBrowser(adminPage, "admin", "/admin/support");
try {
  await adminPage.getByText(`Ticket: ${browserTicketId}`, { exact: true }).waitFor({ timeout: 10000 });
} catch (error) {
  const body = (await adminPage.locator("body").innerText().catch(() => "<body unavailable>")).slice(0, 1800);
  const ticketCount = queryDbScalar(`select count(*) from public.support_tickets where id=${sqlLiteral(browserTicketId)}::uuid`, "admin browser diagnostic ticket count");
  throw new Error(`Admin browser support queue did not render the real Client ticket: url=${adminPage.url()} ticket=${browserTicketId} db_count=${ticketCount} body=${JSON.stringify(body)} cause=${error?.message || error}`);
}
console.log("Admin browser support queue reads real Client ticket: PASS");

await clientApi.auth.signOut({ scope: "local" });
await otherClientApi.auth.signOut({ scope: "local" });
await adminApi.auth.signOut({ scope: "local" });
await clientContext.close();
await adminContext.close();
await browser.close();

console.log("KÖL local Client Support browser/RPC/DB runtime: PASS");
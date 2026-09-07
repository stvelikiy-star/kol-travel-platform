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
  throw new Error("Local Admin Support QA requires local Supabase credentials, database URL and application URL.");
}

function assertLocalUrl(value, label) {
  const url = new URL(value);
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new Error(`Refusing ${label} against non-local host: ${url.hostname}`);
  }
}
assertLocalUrl(supabaseUrl, "Admin Support Auth fixtures");
assertLocalUrl(localDbUrl, "Admin Support database fixtures");
assertLocalUrl(appBaseUrl, "Admin Support browser runtime");

const PASSWORD = "KolAdminSupport!2026";
const RUN_SUFFIX = String(
  process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT || "1"}`
    : `${Date.now()}-${process.pid}`
).replace(/[^a-zA-Z0-9-]/g, "-");
const specs = {
  client: { email: `qa-admin-support-client-${RUN_SUFFIX}@kol.test`, role: "client" },
  supportAdmin: { email: `qa-admin-support-admin-${RUN_SUFFIX}@kol.test`, role: "support_admin" },
  dispatcher: { email: `qa-admin-support-dispatcher-${RUN_SUFFIX}@kol.test`, role: "dispatcher" }
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
      user_metadata: { name: `Admin Support QA ${key}`, local_admin_support_qa: true }
    }
  });
  const user = payload?.user || payload;
  if (!user?.id) throw new Error(`Admin Support QA ${key} user returned no id`);
  return user.id;
}

const clientId = await createAuthUser("client");
const supportAdminId = await createAuthUser("supportAdmin");
const dispatcherId = await createAuthUser("dispatcher");

execDb(`begin;
insert into public.user_profiles (user_id,full_name,email,locale,status) values
  (${sqlLiteral(clientId)}::uuid,'QA Admin Support Client',${sqlLiteral(specs.client.email)},'ru','active'),
  (${sqlLiteral(supportAdminId)}::uuid,'QA Support Admin',${sqlLiteral(specs.supportAdmin.email)},'ru','active'),
  (${sqlLiteral(dispatcherId)}::uuid,'QA Readonly Dispatcher',${sqlLiteral(specs.dispatcher.email)},'ru','active');
insert into public.user_roles (user_id,role,scope_id,is_active) values
  (${sqlLiteral(clientId)}::uuid,'client',null,true),
  (${sqlLiteral(supportAdminId)}::uuid,'support_admin',null,true),
  (${sqlLiteral(dispatcherId)}::uuid,'dispatcher',null,true);
insert into public.client_profiles (user_id,default_address) values
  (${sqlLiteral(clientId)}::uuid,'QA support client address');
insert into public.admin_profiles (user_id,admin_level,department) values
  (${sqlLiteral(supportAdminId)}::uuid,'support_admin','Support QA'),
  (${sqlLiteral(dispatcherId)}::uuid,'dispatcher','Dispatch QA');
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
const supportAdminApi = await signInClient("supportAdmin");
const dispatcherApi = await signInClient("dispatcher");

const createRequestId = `admin-support-ticket-${RUN_SUFFIX}`;
const { data: created, error: createError } = await clientApi.rpc("client_support_ticket_create_atomic", {
  p_category: "technical",
  p_title: `Admin Support Lifecycle ${RUN_SUFFIX}`,
  p_message: "Client Support lifecycle initial message must stay unchanged.",
  p_request_id: createRequestId,
  p_related_order_id: null,
  p_related_booking_id: null
});
if (createError || created?.ok !== true || !created?.ticket_id) {
  throw new Error(`Admin Support fixture ticket creation failed: ${createError?.message || JSON.stringify(created)}`);
}
const ticketId = created.ticket_id;
assertEqual(queryDbScalar(`select status from public.support_tickets where id=${sqlLiteral(ticketId)}::uuid`), "open", "Admin Support fixture status");

const { error: directUpdateError } = await supportAdminApi
  .from("support_tickets")
  .update({ status: "closed" })
  .eq("id", ticketId);
if (!directUpdateError) throw new Error("Support admin direct support_tickets UPDATE unexpectedly succeeded");
console.log("Admin Support direct DML fail-closed: PASS");

const { error: dispatcherWriteError } = await dispatcherApi.rpc("admin_support_lifecycle_atomic", {
  p_ticket_id: ticketId,
  p_action: "reply",
  p_request_id: `dispatcher-denied-${RUN_SUFFIX}`,
  p_message: "Dispatcher must not write support replies.",
  p_status: null,
  p_reason: null
});
if (!dispatcherWriteError) throw new Error("Dispatcher unexpectedly executed Admin Support lifecycle RPC");
console.log("Admin Support role scope fail-closed: PASS");

const replyRequestId = `admin-reply-${RUN_SUFFIX}`;
const replyText = "Admin Support reply remains exact and visible to the Client.";
const replyArgs = {
  p_ticket_id: ticketId,
  p_action: "reply",
  p_request_id: replyRequestId,
  p_message: replyText,
  p_status: null,
  p_reason: null
};
const { data: reply, error: replyError } = await supportAdminApi.rpc("admin_support_lifecycle_atomic", replyArgs);
if (replyError || reply?.ok !== true || !reply?.message_id || reply?.status !== "open") {
  throw new Error(`Admin Support reply failed: ${replyError?.message || JSON.stringify(reply)}`);
}
assertEqual(queryDbScalar(`select count(*) from public.ticket_messages where ticket_id=${sqlLiteral(ticketId)}::uuid and sender_id=${sqlLiteral(supportAdminId)}::uuid and message=${sqlLiteral(replyText)}`), "1", "Admin reply message count");
assertEqual(queryDbScalar(`select count(*) from public.audit_logs where action='admin_support_reply' and entity_id=${sqlLiteral(ticketId)}::uuid and request_id=${sqlLiteral(replyRequestId)}`), "1", "Admin reply audit count");
console.log("Admin Support reply -> message/audit: PASS");

const { data: replyReplay, error: replyReplayError } = await supportAdminApi.rpc("admin_support_lifecycle_atomic", replyArgs);
if (replyReplayError || replyReplay?.ok !== true || replyReplay?.idempotent !== true) {
  throw new Error(`Admin Support reply replay was not idempotent: ${replyReplayError?.message || JSON.stringify(replyReplay)}`);
}
assertEqual(queryDbScalar(`select count(*) from public.ticket_messages where ticket_id=${sqlLiteral(ticketId)}::uuid and sender_id=${sqlLiteral(supportAdminId)}::uuid and message=${sqlLiteral(replyText)}`), "1", "Admin reply replay message count");

const { error: replyConflict } = await supportAdminApi.rpc("admin_support_lifecycle_atomic", {
  ...replyArgs,
  p_message: "Changed payload must conflict."
});
if (!replyConflict) throw new Error("Admin Support changed reply payload unexpectedly reused request id");
console.log("Admin Support reply idempotency conflict: PASS");

const { error: skipStatusError } = await supportAdminApi.rpc("admin_support_lifecycle_atomic", {
  p_ticket_id: ticketId,
  p_action: "status",
  p_request_id: `skip-status-${RUN_SUFFIX}`,
  p_message: null,
  p_status: "resolved",
  p_reason: "Skipping in_progress must fail."
});
if (!skipStatusError) throw new Error("Admin Support invalid status jump unexpectedly succeeded");
assertEqual(queryDbScalar(`select status from public.support_tickets where id=${sqlLiteral(ticketId)}::uuid`), "open", "Invalid status jump preserved open");

for (const [fromStatus, toStatus] of [["open", "in_progress"], ["in_progress", "resolved"], ["resolved", "closed"]]) {
  assertEqual(queryDbScalar(`select status from public.support_tickets where id=${sqlLiteral(ticketId)}::uuid`), fromStatus, `Status before ${toStatus}`);
  const requestId = `status-${toStatus}-${RUN_SUFFIX}`;
  const reason = `QA transition ${fromStatus} to ${toStatus}`;
  const { data, error } = await supportAdminApi.rpc("admin_support_lifecycle_atomic", {
    p_ticket_id: ticketId,
    p_action: "status",
    p_request_id: requestId,
    p_message: null,
    p_status: toStatus,
    p_reason: reason
  });
  if (error || data?.ok !== true || data?.status !== toStatus) {
    throw new Error(`Admin Support ${fromStatus}->${toStatus} failed: ${error?.message || JSON.stringify(data)}`);
  }
  assertEqual(queryDbScalar(`select status from public.support_tickets where id=${sqlLiteral(ticketId)}::uuid`), toStatus, `Status after ${toStatus}`);
  assertEqual(queryDbScalar(`select count(*) from public.audit_logs where action='admin_support_status_changed' and entity_id=${sqlLiteral(ticketId)}::uuid and request_id=${sqlLiteral(requestId)} and reason=${sqlLiteral(reason)}`), "1", `Audit for ${toStatus}`);
}
console.log("Admin Support linear status lifecycle: PASS");

const { error: closedReplyError } = await supportAdminApi.rpc("admin_support_lifecycle_atomic", {
  p_ticket_id: ticketId,
  p_action: "reply",
  p_request_id: `closed-reply-${RUN_SUFFIX}`,
  p_message: "Closed ticket must reject this reply.",
  p_status: null,
  p_reason: null
});
if (!closedReplyError) throw new Error("Closed Admin Support ticket unexpectedly accepted a reply");
console.log("Admin Support closed-ticket immutability: PASS");

const browserCreateRequest = `browser-admin-support-${RUN_SUFFIX}`;
const browserTitle = `Browser Admin Support ${RUN_SUFFIX}`;
const browserInitial = "Browser client initial Support message.";
const { data: browserCreated, error: browserCreateError } = await clientApi.rpc("client_support_ticket_create_atomic", {
  p_category: "general",
  p_title: browserTitle,
  p_message: browserInitial,
  p_request_id: browserCreateRequest,
  p_related_order_id: null,
  p_related_booking_id: null
});
if (browserCreateError || browserCreated?.ok !== true || !browserCreated?.ticket_id) {
  throw new Error(`Browser Admin Support fixture creation failed: ${browserCreateError?.message || JSON.stringify(browserCreated)}`);
}
const browserTicketId = browserCreated.ticket_id;

const browser = await chromium.launch({ headless: true });
async function loginBrowser(page, key, nextPath) {
  const response = await page.goto(`${appBaseUrl}/login?next=${encodeURIComponent(nextPath)}`, { waitUntil: "domcontentloaded" });
  const emailInput = page.locator('input[name="email"]');
  const passwordInput = page.locator('input[name="password"]');
  try {
    await emailInput.waitFor({ timeout: 10000 });
    await passwordInput.waitFor({ timeout: 10000 });
  } catch (error) {
    const body = (await page.locator("body").innerText().catch(() => "<body unavailable>")).slice(0, 1600);
    throw new Error(`Admin Support login unavailable for ${key}: url=${page.url()} http=${response?.status() ?? "unknown"} body=${JSON.stringify(body)} cause=${error?.message || error}`);
  }
  await emailInput.fill(specs[key].email);
  await passwordInput.fill(PASSWORD);
  await Promise.all([
    page.waitForURL((url) => url.pathname === nextPath, { timeout: 15000 }),
    page.locator('button[type="submit"]').click()
  ]);
}

const adminContext = await browser.newContext();
const adminPage = await adminContext.newPage();
await loginBrowser(adminPage, "supportAdmin", "/admin/support");
const adminTicket = adminPage.locator(`[data-support-ticket="${browserTicketId}"]`);
await adminTicket.waitFor({ timeout: 10000 });
await adminTicket.getByText(browserTitle, { exact: true }).waitFor({ timeout: 10000 });
await adminTicket.getByText(browserInitial, { exact: true }).waitFor({ timeout: 10000 });

const browserReply = "Browser Admin Support reply must remain exact for Client.";
const replyForm = adminTicket.getByTestId("admin-support-reply-form");
await replyForm.locator('textarea[name="message"]').fill(browserReply);
await Promise.all([
  adminPage.waitForURL((url) => url.pathname === "/admin/support" && url.searchParams.get("adminSupport") === "success" && url.searchParams.get("action") === "reply", { timeout: 15000 }),
  replyForm.getByRole("button", { name: "Отправить ответ" }).click()
]);
assertEqual(queryDbScalar(`select count(*) from public.ticket_messages where ticket_id=${sqlLiteral(browserTicketId)}::uuid and sender_id=${sqlLiteral(supportAdminId)}::uuid and message=${sqlLiteral(browserReply)}`), "1", "Browser admin reply DB count");
console.log("Admin browser reply -> server action -> RPC -> DB: PASS");

const clientContext = await browser.newContext();
const clientPage = await clientContext.newPage();
await loginBrowser(clientPage, "client", "/client/support");
const clientConversation = clientPage.locator(`[data-support-conversation="${browserTicketId}"]`);
await clientConversation.waitFor({ timeout: 10000 });
await clientConversation.getByText(browserInitial, { exact: true }).waitFor({ timeout: 10000 });
await clientConversation.getByText(browserReply, { exact: true }).waitFor({ timeout: 10000 });
console.log("Client browser sees Admin reply unchanged through RLS: PASS");

await adminPage.goto(`${appBaseUrl}/admin/support`, { waitUntil: "domcontentloaded" });
const refreshedTicket = adminPage.locator(`[data-support-ticket="${browserTicketId}"]`);
const statusForm = refreshedTicket.getByTestId("admin-support-status-form");
await statusForm.locator('input[name="reason"]').fill("Support agent accepted the ticket for work.");
await Promise.all([
  adminPage.waitForURL((url) => url.pathname === "/admin/support" && url.searchParams.get("adminSupport") === "success" && url.searchParams.get("action") === "status", { timeout: 15000 }),
  statusForm.getByRole("button", { name: "Взять в работу" }).click()
]);
assertEqual(queryDbScalar(`select status from public.support_tickets where id=${sqlLiteral(browserTicketId)}::uuid`), "in_progress", "Browser status transition");
console.log("Admin browser status -> server action -> RPC -> DB: PASS");

const dispatcherContext = await browser.newContext();
const dispatcherPage = await dispatcherContext.newPage();
await loginBrowser(dispatcherPage, "dispatcher", "/admin/support");
const readonlyTicket = dispatcherPage.locator(`[data-support-ticket="${browserTicketId}"]`);
await readonlyTicket.waitFor({ timeout: 10000 });
await dispatcherPage.getByText("Текущая административная роль имеет только чтение очереди поддержки.", { exact: true }).waitFor({ timeout: 10000 });
assertEqual(await readonlyTicket.getByTestId("admin-support-reply-form").count(), 0, "Dispatcher reply form hidden");
assertEqual(await readonlyTicket.getByTestId("admin-support-status-form").count(), 0, "Dispatcher status form hidden");
console.log("Dispatcher browser support queue is read-only: PASS");

await clientApi.auth.signOut({ scope: "local" });
await supportAdminApi.auth.signOut({ scope: "local" });
await dispatcherApi.auth.signOut({ scope: "local" });
await clientContext.close();
await adminContext.close();
await dispatcherContext.close();
await browser.close();

console.log("KÖL local Admin Support browser/RPC/DB runtime: PASS");

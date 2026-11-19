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
  dispatcher: { email: `qa-admin-support-dispatcher-${RUN_SUFFIX}@kol.test`, role: "dispatcher" },
  partner: { email: `qa-admin-support-partner-${RUN_SUFFIX}@kol.test`, role: "partner_owner" },
  courier: { email: `qa-admin-support-courier-${RUN_SUFFIX}@kol.test`, role: "courier" }
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
const partnerId = await createAuthUser("partner");
const courierId = await createAuthUser("courier");

execDb(`begin;
insert into public.user_profiles (user_id,full_name,email,locale,status) values
  (${sqlLiteral(clientId)}::uuid,'QA Admin Support Client',${sqlLiteral(specs.client.email)},'ru','active'),
  (${sqlLiteral(supportAdminId)}::uuid,'QA Support Admin',${sqlLiteral(specs.supportAdmin.email)},'ru','active'),
  (${sqlLiteral(dispatcherId)}::uuid,'QA Readonly Dispatcher',${sqlLiteral(specs.dispatcher.email)},'ru','active'),
  (${sqlLiteral(partnerId)}::uuid,'QA Delivery Partner',${sqlLiteral(specs.partner.email)},'ru','active'),
  (${sqlLiteral(courierId)}::uuid,'QA Delivery Courier',${sqlLiteral(specs.courier.email)},'ru','active');
insert into public.user_roles (user_id,role,scope_id,is_active) values
  (${sqlLiteral(clientId)}::uuid,'client',null,true),
  (${sqlLiteral(supportAdminId)}::uuid,'support_admin',null,true),
  (${sqlLiteral(dispatcherId)}::uuid,'dispatcher',null,true),
  (${sqlLiteral(courierId)}::uuid,'courier',null,true);
insert into public.client_profiles (user_id,default_address) values
  (${sqlLiteral(clientId)}::uuid,'QA support client address');
insert into public.admin_profiles (user_id,admin_level,department) values
  (${sqlLiteral(supportAdminId)}::uuid,'support_admin','Support QA'),
  (${sqlLiteral(dispatcherId)}::uuid,'dispatcher','Dispatch QA');
insert into public.courier_profiles (user_id,vehicle_type,vehicle_number,working_zone,availability_status)
 values(${sqlLiteral(courierId)}::uuid,'car','QA-INTAKE-DELIVERY','Cholpon-Ata','online');
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
const intakeName = "QA Intake Contact";
const intakePhone = "+996700123456";
const intakeRequest = "QA request details for the support operator";
execDb(`update public.support_tickets set request_payload = ${sqlLiteral(JSON.stringify({
  contact: { name: intakeName, phone: intakePhone }, requested_items: intakeRequest,
  contact_phone_hash: "qa-internal-hash-must-not-render", request_fingerprint: "qa-internal-fingerprint"
}))}::jsonb where id=${sqlLiteral(browserTicketId)}::uuid;`);

const browser = await chromium.launch({ headless: true });
async function loginBrowser(page, key, nextPath) {
  const response = await page.goto(`${appBaseUrl}/login?next=${encodeURIComponent(nextPath)}`, { waitUntil: "domcontentloaded" });
  const emailInput = page.locator('form:has(input[name="password"]) input[name="email"]');
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
    page.locator('form:has(input[name="password"]) button[type="submit"]').click()
  ]);
}

const adminContext = await browser.newContext();
const adminPage = await adminContext.newPage();
await loginBrowser(adminPage, "supportAdmin", "/admin/support");
const adminTicket = adminPage.locator(`[data-support-ticket="${browserTicketId}"]`);
await adminTicket.waitFor({ timeout: 10000 });
await adminTicket.getByText(browserTitle, { exact: true }).waitFor({ timeout: 10000 });
await adminTicket.getByText(browserInitial, { exact: true }).waitFor({ timeout: 10000 });
const intakeDetails = adminTicket.locator("[data-intake-details]");
for (const value of [intakeName, intakePhone, intakeRequest]) {
  await intakeDetails.getByText(value, { exact: true }).waitFor({ timeout: 10000 });
}
const intakeText = await intakeDetails.innerText();
if (intakeText.includes("qa-internal-hash") || intakeText.includes("qa-internal-fingerprint")) {
  throw new Error("Internal public-intake metadata must not be rendered to the operator.");
}
console.log("Admin browser sees public intake contact and request without internal metadata: PASS");

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


const linkBusinessId = queryDbScalar("select gen_random_uuid()::text", "intake link business id");
const linkProductId = queryDbScalar("select gen_random_uuid()::text", "intake link product id");
const linkTicketId = queryDbScalar("select gen_random_uuid()::text", "intake link ticket id");
const linkRequestId = `intake-${linkTicketId}`;
execDb(`begin;
insert into public.partners (id,owner_user_id,type,title,slug,description,location,address,phone,status,business_status,rating)
values (${sqlLiteral(linkBusinessId)}::uuid,${sqlLiteral(supportAdminId)}::uuid,'shop','QA Linked Shop',
${sqlLiteral(`qa-link-${RUN_SUFFIX}`)},'QA intake link source','Cholpon-Ata','QA Pickup','+996700001333','approved','online',5);
insert into public.shops (business_id,delivery_enabled) values (${sqlLiteral(linkBusinessId)}::uuid,false);
insert into public.products (id,business_id,title,description,price,stock_qty,status)
values (${sqlLiteral(linkProductId)}::uuid,${sqlLiteral(linkBusinessId)}::uuid,'QA Linked Product',
  'QA trusted product',900,20,'active');
insert into public.support_tickets (id,created_by,category,priority,status,title,request_payload)
values (${sqlLiteral(linkTicketId)}::uuid,null,'order_request','medium','open',
 'QA Linked Intake',
 jsonb_build_object(
  'contact',jsonb_build_object('name','QA Verified Client','email',${sqlLiteral(specs.client.email)}),
  'cart_items', jsonb_build_array(jsonb_build_object(
    'id',${sqlLiteral(linkProductId)},'type','product','quantity',2))));
commit;`);

await clientPage.goto(`${appBaseUrl}/client/support`, { waitUntil: "domcontentloaded" });
const claimForm = clientPage.getByTestId("claim-anonymous-intake-form");
await claimForm.waitFor({ timeout: 10000 });
await claimForm.locator('input[name="ticketId"]').fill(linkTicketId);
await Promise.all([
  clientPage.waitForURL((url) => url.pathname === "/client/support" &&
    url.searchParams.get("support") === "claimed", { timeout: 15000 }),
  claimForm.getByRole("button", { name: "Подтвердить принадлежность заявки" }).click()
]);
assertEqual(queryDbScalar(`select created_by::text from public.support_tickets where id=${sqlLiteral(linkTicketId)}::uuid`),
  clientId, "Verified-email client claimed original anonymous ticket");
const { data: claimReplay, error: claimReplayError } = await clientApi.rpc(
  "claim_anonymous_intake_by_verified_email_atomic", {
    p_ticket_id: linkTicketId, p_request_id: `client-claim-direct-${RUN_SUFFIX}`
  });
if (claimReplayError || claimReplay?.ok !== true) {
  throw new Error(`Claim replay rejected: ${claimReplayError?.message || JSON.stringify(claimReplay)}`);
}
const { error: wrongRoleClaim } = await dispatcherApi.rpc(
  "claim_anonymous_intake_by_verified_email_atomic", {
    p_ticket_id: linkTicketId, p_request_id: `dispatcher-claim-denied-${RUN_SUFFIX}`
  });
if (!wrongRoleClaim) throw new Error("Dispatcher was allowed to claim client intake");
console.log("Anonymous intake -> verified-email Client browser claim / PostgreSQL + role denial: PASS");

const deliveryTicketId = queryDbScalar("select gen_random_uuid()::text");
execDb(`insert into public.support_tickets
  (id,created_by,category,priority,status,title,request_payload) values
  (${sqlLiteral(deliveryTicketId)}::uuid,${sqlLiteral(clientId)}::uuid,'order_request','medium','open',
   'QA Delivery Tariff Quote',
   jsonb_build_object('delivery_method','delivery',
     'delivery',jsonb_build_object('location','Чолпон-Ата','address','QA Street 11')));`);
const tariffArgs = {
  p_ticket_id: deliveryTicketId,
  p_business_id: linkBusinessId,
  p_zone_code: "cholpon-ata"
};
const { error: unconfiguredTariff } = await supportAdminApi.rpc(
  "quote_intake_delivery_fee_atomic", tariffArgs
);
if (!unconfiguredTariff) throw new Error("Unconfigured delivery price was accepted");
execDb(`insert into private.kol_delivery_tariffs
  (business_id,zone_code,fee_som,currency,active,approved_by,approved_at)
  values(${sqlLiteral(linkBusinessId)}::uuid,'cholpon-ata',180,'KGS',true,
         ${sqlLiteral(supportAdminId)}::uuid,now());`);
const { data: quote, error: quoteError } = await supportAdminApi.rpc(
  "quote_intake_delivery_fee_atomic", tariffArgs
);
if (quoteError || quote?.ok !== true || Number(quote?.fee_som) !== 180 ||
    quote?.currency !== "KGS" || quote?.order_created !== false) {
  throw new Error(`Authoritative KGS quote failed: ${quoteError?.message || JSON.stringify(quote)}`);
}
const { error: wrongQuoteZone } = await supportAdminApi.rpc(
  "quote_intake_delivery_fee_atomic", {...tariffArgs,p_zone_code:"karakol"}
);
if (!wrongQuoteZone) throw new Error("Non-matching delivery zone accepted");
const { error: dispatcherQuote } = await dispatcherApi.rpc(
  "quote_intake_delivery_fee_atomic",tariffArgs
);
if (!dispatcherQuote) throw new Error("Dispatcher was allowed to price unconfirmed intake");
console.log("Server-approved KGS tariff: no-default, correct quote, wrong-zone and wrong-role denial: PASS");

const { data: linkedOrderId, error: linkedOrderError } = await clientApi.rpc("create_order_atomic", {
  p_business_id: linkBusinessId,
  p_order_type: "shop",
  p_items: [{ item_id: linkProductId, qty: 2 }],
  p_delivery_method: "pickup",
  p_idempotency_key: linkRequestId
});
if (linkedOrderError || typeof linkedOrderId !== "string") {
  throw new Error(`Verified intake client order creation failed: ${linkedOrderError?.message || JSON.stringify(linkedOrderId)}`);
}
assertEqual(queryDbScalar(`select total::text from public.orders where id=${sqlLiteral(linkedOrderId)}::uuid`),
 "1800.00", "Linked order database-authoritative amount");
await adminPage.goto(`${appBaseUrl}/admin/support`, { waitUntil: "domcontentloaded" });
const linkedTicketCard = adminPage.locator(`[data-support-ticket="${linkTicketId}"]`);
const linkForm = linkedTicketCard.getByTestId("admin-support-intake-link-form");
await linkForm.waitFor({ timeout: 10000 });
const linkFormRequestId = await linkForm.locator('input[name="requestId"]').inputValue();
await linkForm.locator('input[name="orderId"]').fill(linkedOrderId);
await Promise.all([
  adminPage.waitForURL((url) => url.pathname === "/admin/support" && url.searchParams.get("adminSupport") === "success" && url.searchParams.get("action") === "link_order", { timeout: 15000 }),
  linkForm.getByRole("button", { name: "Связать существующий заказ" }).click()
]);
assertEqual(queryDbScalar(`select related_order_id::text from public.support_tickets where id=${sqlLiteral(linkTicketId)}::uuid`),
 linkedOrderId, "Operator browser linked intake to same order");
const { data: linkReplay, error: linkReplayError } = await supportAdminApi.rpc("admin_link_intake_pickup_order_atomic", {
  p_ticket_id: linkTicketId, p_order_id: linkedOrderId, p_request_id: linkFormRequestId
});
if (linkReplayError || linkReplay?.idempotent !== true) {
 throw new Error(`Operator intake link replay failed: ${linkReplayError?.message || JSON.stringify(linkReplay)}`);
}
assertEqual(queryDbScalar(`select count(*)::text from public.audit_logs where action='admin_intake_pickup_order_linked' and entity_id=${sqlLiteral(linkTicketId)}::uuid`),
 "1", "Operator intake link one audit row after replay");
const { error: unauthorizedLinkError } = await dispatcherApi.rpc("admin_link_intake_pickup_order_atomic", {
  p_ticket_id: linkTicketId, p_order_id: linkedOrderId, p_request_id: `dispatcher-intake-denied-${RUN_SUFFIX}`
});
if (!unauthorizedLinkError) throw new Error("Dispatcher was allowed to link an intake ticket");
console.log("Verified Client order -> Operator browser intake link -> same DB order + replay/role: PASS");


const flowBusinessId = queryDbScalar("select gen_random_uuid()::text");
const flowProductId = queryDbScalar("select gen_random_uuid()::text");
let flowTicketId = "";
// An actual anonymous intake, not an order seeded directly by the QA runner.
execDb(`begin;
insert into public.partners
 (id,owner_user_id,type,title,slug,description,location,address,phone,status,business_status,rating)
 values(${sqlLiteral(flowBusinessId)}::uuid,${sqlLiteral(partnerId)}::uuid,'shop',
 'QA One Order Partner',${sqlLiteral(`qa-unified-flow-${RUN_SUFFIX}`)},
 'QA one-ticket delivery','Чолпон-Ата','QA Pickup 2','+996700001777','approved','online',5);
insert into public.user_roles (user_id,role,scope_id,is_active)
 values(${sqlLiteral(partnerId)}::uuid,'partner_owner',${sqlLiteral(flowBusinessId)}::uuid,true);
insert into public.partner_profiles (user_id,business_id,position)
 values(${sqlLiteral(partnerId)}::uuid,${sqlLiteral(flowBusinessId)}::uuid,'QA owner');
insert into public.partner_staff (business_id,user_id,role,is_active)
 values(${sqlLiteral(flowBusinessId)}::uuid,${sqlLiteral(partnerId)}::uuid,'partner_owner',true);
insert into public.shops (business_id,delivery_enabled)
 values(${sqlLiteral(flowBusinessId)}::uuid,true);
insert into public.products (id,business_id,title,description,price,stock_qty,status)
 values(${sqlLiteral(flowProductId)}::uuid,${sqlLiteral(flowBusinessId)}::uuid,
   'QA Unified Product','One actual order delivery E2E',900,10,'active');
insert into private.kol_delivery_tariffs
 (business_id,zone_code,fee_som,currency,active,approved_by,approved_at)
 values(${sqlLiteral(flowBusinessId)}::uuid,'cholpon-ata',180,'KGS',
   true,${sqlLiteral(supportAdminId)}::uuid,now());
commit;`);
// Start the very same delivery E2E at the real anonymous public browser form.
// No test-only support_tickets INSERT: the Server Action uses the atomic 033 RPC.
const anonymousContext = await browser.newContext();
const cartItem = {
  id: flowProductId, itemType: "product", businessId: flowBusinessId,
  title: "QA Unified Product", partnerName: "QA One Order Partner",
  quantity: 2, price: 1, currency: "KGS", status: "active"
};
await anonymousContext.addInitScript((item) => {
  window.localStorage.setItem("kol-cart-v1", JSON.stringify([item]));
}, cartItem);
const anonymousPage = await anonymousContext.newPage();
await anonymousPage.goto(`${appBaseUrl}/checkout`, { waitUntil: "domcontentloaded" });
await anonymousPage.getByText("QA Unified Product × 2", { exact: true }).first().waitFor({ timeout: 15000 });
await anonymousPage.getByPlaceholder("Ваше имя *").fill("QA Full Flow");
await anonymousPage.getByPlaceholder("Телефон *").fill("+996700005555");
// Use the third visible contact input, independent of runtime placeholder translation.
const emailField = anonymousPage.locator('main input').filter({ visible: true }).nth(2);
try {
  await emailField.fill(specs.client.email, { timeout: 10000 });
} catch (error) {
  const fields = await anonymousPage.locator('main input').evaluateAll(inputs =>
    inputs.slice(0, 8).map(input => ({ name: input.name, placeholder: input.placeholder, type: input.type })));
  throw new Error(`Public intake email field missing at ${anonymousPage.url()} fields=${JSON.stringify(fields)}; ${String(error)}`);
}
await anonymousPage.locator("main select").nth(0).selectOption("delivery");
await anonymousPage.locator("main select").nth(1).selectOption("Чолпон-Ата");
await anonymousPage.getByPlaceholder("Адрес / отель / ориентир").fill("QA Full Flow Street 5");
await anonymousPage.waitForTimeout(3300);
await anonymousPage.getByRole("button", { name: "Отправить заявку", exact: true }).click();
await anonymousPage.getByText("Заявка принята.", { exact: true }).waitFor({ timeout: 20000 });
flowTicketId = (await anonymousPage.locator('p:has-text("Номер:") span.font-mono').innerText()).trim();
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(flowTicketId)) {
  throw new Error("Public browser did not return a valid atomic intake UUID");
}
assertEqual(queryDbScalar(`select category || ':' || status || ':' ||
   (request_payload->>'delivery_method') || ':' || (request_payload->>'intake_version')
  from public.support_tickets where id=${sqlLiteral(flowTicketId)}::uuid`),
  "order_request:open:delivery:3", "same-ticket browser intake status/atomic version");
assertEqual(queryDbScalar(`select request_payload->'cart_items'->0->>'id'
  from public.support_tickets where id=${sqlLiteral(flowTicketId)}::uuid`),
  flowProductId, "browser intake item persisted for later operator pricing");
assertEqual(queryDbScalar(`select count(*) from public.support_tickets where id=${sqlLiteral(flowTicketId)}::uuid`),
  "1", "single public ticket after browser send");
await anonymousContext.close();
console.log("ONE_ORDER_E2E anonymous public browser -> atomic intake #033 -> same DB ticket: PASS");

// Client confirms identity in the same browser used for the prior support checks.
await clientPage.goto(`${appBaseUrl}/client/support`, { waitUntil: "domcontentloaded" });
const fullClaimForm = clientPage.getByTestId("claim-anonymous-intake-form");
await fullClaimForm.locator('input[name="ticketId"]').fill(flowTicketId);
await Promise.all([
  clientPage.waitForURL((url) => url.pathname === "/client/support" &&
    url.searchParams.get("support") === "claimed", { timeout: 15000 }),
  fullClaimForm.getByRole("button", {name:"Подтвердить принадлежность заявки"}).click()
]);
assertEqual(queryDbScalar(`select created_by::text from public.support_tickets
 where id=${sqlLiteral(flowTicketId)}::uuid`),clientId,
 "same-order flow verified original anonymous ticket");

await adminPage.goto(`${appBaseUrl}/admin/support`, {waitUntil:"domcontentloaded"});
const flowCard = adminPage.locator(`[data-support-ticket="${flowTicketId}"]`);
const quoteForm = flowCard.getByTestId("admin-support-delivery-quote-form");
await quoteForm.waitFor({timeout:10000});
await quoteForm.locator('input[name="businessId"]').fill(flowBusinessId);
await quoteForm.locator('select[name="zoneCode"]').selectOption("cholpon-ata");
await Promise.all([
  adminPage.waitForURL((url) => url.pathname === "/admin/support" &&
    url.searchParams.get("adminSupport") === "quote", {timeout:15000}),
  quoteForm.getByRole("button",{name:"Проверить тариф KGS"}).click()
]);
await adminPage.getByText("Тариф по базе: 180.00 сом.", {exact:false}).waitFor({timeout:10000});
const confirmationForm = adminPage.locator(`[data-support-ticket="${flowTicketId}"]`)
  .getByTestId("admin-support-confirm-intake-order-form");
await confirmationForm.locator('input[name="businessId"]').fill(flowBusinessId);
await confirmationForm.locator('input[name="confirmedDeliveryFee"]').fill("180.00");
await confirmationForm.locator('textarea[name="confirmationNote"]')
  .fill("QA: customer confirmed products, address and 180 KGS delivery charge.");
const confirmationRequestId = await confirmationForm.locator('input[name="requestId"]').inputValue();
await Promise.all([
  adminPage.waitForURL((url) => url.pathname === "/admin/support" &&
    url.searchParams.get("adminSupport") === "success" &&
    url.searchParams.get("action") === "confirm_order", {timeout:20000}),
  confirmationForm.getByRole("button",{name:"Подтвердить и создать заказ"}).click()
]);
const flowOrderId = queryDbScalar(`select related_order_id::text from public.support_tickets
 where id=${sqlLiteral(flowTicketId)}::uuid`);
if (!flowOrderId || !/^[0-9a-f-]{36}$/.test(flowOrderId)) throw new Error("Operator confirmation missing linked order");
const flowDeliveryId = queryDbScalar(`select id::text from public.deliveries
 where order_id=${sqlLiteral(flowOrderId)}::uuid`);
if (!flowDeliveryId || !/^[0-9a-f-]{36}$/.test(flowDeliveryId)) throw new Error("Operator order missing delivery row");
assertEqual(queryDbScalar(`select total::text || ':' || delivery_fee::text || ':' || payment_status
 from public.orders where id=${sqlLiteral(flowOrderId)}::uuid`),
 "1980.00:180.00:pending","one-order authority over price/fee/payment");
assertEqual(queryDbScalar(`select delivery_id::text from public.order_delivery
 where order_id=${sqlLiteral(flowOrderId)}::uuid`),flowDeliveryId,"same order delivery linked");
const {data:confirmReplay,error:confirmReplayError}=await supportAdminApi.rpc(
 "admin_confirm_intake_order_atomic",{
   p_ticket_id:flowTicketId,p_business_id:flowBusinessId,
   p_confirmed_delivery_fee_som:180,
   p_confirmation_note:"QA: customer confirmed products, address and 180 KGS delivery charge.",
   p_request_id:confirmationRequestId
 });
if (confirmReplayError || confirmReplay?.idempotent!==true ||
    confirmReplay?.order_id!==flowOrderId) throw new Error("one-order operator replay was not idempotent");
assertEqual(queryDbScalar(`select count(*)::text from public.orders
 where metadata->>'idempotency_key'=${sqlLiteral(`intake-${flowTicketId}`)}`),
 "1","single order after retry");
console.log("ONE_ORDER_E2E anonymous intake -> verified Auth -> operator quoted and created ONE priced order: PASS");

// Partner prepares the exact same order using its normal browser.
const partnerContext = await browser.newContext();
const partnerPage=await partnerContext.newPage();
await loginBrowser(partnerPage,"partner","/partner/orders");
for(const [label,action,status] of [
 ["Принять заказ","accept","accepted_by_partner"],
 ["Начать приготовление","start_preparing","preparing"],
 ["Готов к выдаче","mark_ready","ready_for_pickup"]
]){
 await partnerPage.goto(`${appBaseUrl}/partner/orders/${flowOrderId}`,{waitUntil:"networkidle"});
 await Promise.all([
  partnerPage.waitForURL((url)=>url.searchParams.get("partnerAction")==="success" &&
   url.searchParams.get("action")===action,{timeout:15000}),
  partnerPage.getByRole("button",{name:label,exact:true}).click()
 ]);
 assertEqual(queryDbScalar(`select status from public.orders where id=${sqlLiteral(flowOrderId)}::uuid`),
  status,"one-order partner state "+action);
}
console.log("ONE_ORDER_E2E partner accepted and prepared SAME order: PASS");

// Dispatcher assigns a courier using its live Auth session; not a fake
// admin-authenticated direct table UPDATE.
await dispatcherPage.goto(`${appBaseUrl}/admin/delivery`,{waitUntil:"domcontentloaded"});
await dispatcherPage.getByText(flowOrderId,{exact:true}).waitFor({timeout:12000});
const courierSelect=dispatcherPage.getByLabel(`Курьер для доставки ${flowDeliveryId}`);
await courierSelect.selectOption(courierId);
await dispatcherPage.getByRole("button",{name:"Назначить курьера",exact:true}).click();
await dispatcherPage.getByRole("status")
  .filter({hasText:"Курьер назначен сервером"}).waitFor({timeout:15000});
assertEqual(queryDbScalar(`select assigned_courier_id::text from public.deliveries
 where id=${sqlLiteral(flowDeliveryId)}::uuid`),courierId,
 "one-order courier assigned by dispatcher");
console.log("ONE_ORDER_E2E dispatcher assigned courier to SAME order: PASS");

const courierContext=await browser.newContext();
const courierPage=await courierContext.newPage();
await loginBrowser(courierPage,"courier","/courier/active");
await courierPage.getByText(flowDeliveryId,{exact:true}).waitFor({timeout:12000});
for(const [status,label] of [
 ["courier_accepted","Принять доставку"],
 ["courier_to_partner","Выехать к партнёру"],
 ["arrived_at_partner","Подтвердить прибытие к партнёру"],
 ["picked_up","Подтвердить получение заказа"],
 ["courier_to_client","Выехать к клиенту"],
 ["arrived_at_client","Подтвердить прибытие к клиенту"],
 ["delivered","Завершить доставку"]
]){
 const transitionButton=courierPage.getByRole("button",{name:label,exact:true});
 await transitionButton.waitFor({timeout:12000});
 await transitionButton.click();
 // Next.js server actions are asynchronous: wait for PostgreSQL to commit
 // instead of reading the old state on the same event-loop tick.
 let observedStatus="";
 for(let attempt=0;attempt<48;attempt++){
   observedStatus=queryDbScalar(`select status from public.deliveries where id=${sqlLiteral(flowDeliveryId)}::uuid`);
   if(observedStatus===status)break;
   await new Promise((resolve)=>setTimeout(resolve,250));
 }
 assertEqual(observedStatus,status,"one-order courier progression "+status);
}
assertEqual(queryDbScalar(`select status || ':' || payment_status from public.orders
 where id=${sqlLiteral(flowOrderId)}::uuid`),"completed:pending",
 "delivered one-order status; payment still pending");
assertEqual(queryDbScalar(`select count(*)::text from public.delivery_status_history
 where delivery_id=${sqlLiteral(flowDeliveryId)}::uuid`),"9",
 "one delivery initial+assignment+seven courier histories");
assertEqual(queryDbScalar(`select count(*)::text from public.audit_logs
 where entity_id=${sqlLiteral(flowTicketId)}::uuid
 and action='admin_confirm_intake_order_atomic'`),"1",
 "one operator confirmation audit for same ticket");
console.log("KOL ONE ORIGINAL ANONYMOUS TICKET -> VERIFIED CLIENT -> OPERATOR PRICE/ORDER -> PARTNER -> DISPATCHER -> COURIER DELIVERED: PASS");
await partnerContext.close();
await courierContext.close();

await clientApi.auth.signOut({ scope: "local" });
await supportAdminApi.auth.signOut({ scope: "local" });
await dispatcherApi.auth.signOut({ scope: "local" });
await clientContext.close();
await adminContext.close();
await dispatcherContext.close();
await browser.close();

console.log("KÖL local Admin Support browser/RPC/DB runtime: PASS");

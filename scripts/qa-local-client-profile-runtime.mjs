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
  throw new Error("Local Client Profile QA requires local Supabase credentials, database URL and application URL.");
}

function assertLocalUrl(value, label) {
  const url = new URL(value);
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new Error(`Refusing ${label} against non-local host: ${url.hostname}`);
  }
}
assertLocalUrl(supabaseUrl, "Profile Auth fixtures");
assertLocalUrl(localDbUrl, "Profile database fixtures");
assertLocalUrl(appBaseUrl, "Profile browser runtime");

const PASSWORD = "KolClientProfile!2026";
const RUN_SUFFIX = String(
  process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT || "1"}`
    : `${Date.now()}-${process.pid}`
).replace(/[^a-zA-Z0-9-]/g, "-");
const specs = {
  client: { email: `qa-profile-client-${RUN_SUFFIX}@kol.test`, role: "client" },
  otherClient: { email: `qa-profile-other-${RUN_SUFFIX}@kol.test`, role: "client" },
  blockedClient: { email: `qa-profile-blocked-${RUN_SUFFIX}@kol.test`, role: "client" },
  admin: { email: `qa-profile-admin-${RUN_SUFFIX}@kol.test`, role: "support_admin" }
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
      user_metadata: { name: `Client Profile QA ${key}`, local_client_profile_qa: true }
    }
  });
  const user = payload?.user || payload;
  if (!user?.id) throw new Error(`Client Profile QA ${key} user returned no id`);
  return user.id;
}

const clientId = await createAuthUser("client");
const otherClientId = await createAuthUser("otherClient");
const blockedClientId = await createAuthUser("blockedClient");
const adminId = await createAuthUser("admin");

const ORIGINAL_NAME = "QA Profile Original";
const ORIGINAL_ADDRESS = "QA original address";
const ORIGINAL_PHONE = "+996700000001";
const ORIGINAL_METADATA = '{"immutable":"client-profile-qa"}';

execDb(`begin;
insert into public.user_profiles (user_id,full_name,phone,email,locale,preferred_contact,status,metadata) values
  (${sqlLiteral(clientId)}::uuid,${sqlLiteral(ORIGINAL_NAME)},${sqlLiteral(ORIGINAL_PHONE)},${sqlLiteral(specs.client.email)},'ru','email','active',${sqlLiteral(ORIGINAL_METADATA)}::jsonb),
  (${sqlLiteral(otherClientId)}::uuid,'QA Other Profile','+996700000002',${sqlLiteral(specs.otherClient.email)},'ru','email','active','{}'::jsonb),
  (${sqlLiteral(blockedClientId)}::uuid,'QA Blocked Profile','+996700000003',${sqlLiteral(specs.blockedClient.email)},'ru','email','blocked','{}'::jsonb),
  (${sqlLiteral(adminId)}::uuid,'QA Profile Admin','+996700000004',${sqlLiteral(specs.admin.email)},'ru','email','active','{}'::jsonb);
insert into public.user_roles (user_id,role,scope_id,is_active) values
  (${sqlLiteral(clientId)}::uuid,'client',null,true),
  (${sqlLiteral(otherClientId)}::uuid,'client',null,true),
  (${sqlLiteral(blockedClientId)}::uuid,'client',null,true),
  (${sqlLiteral(adminId)}::uuid,'support_admin',null,true);
insert into public.client_profiles (user_id,default_address,metadata) values
  (${sqlLiteral(clientId)}::uuid,${sqlLiteral(ORIGINAL_ADDRESS)},${sqlLiteral(ORIGINAL_METADATA)}::jsonb),
  (${sqlLiteral(otherClientId)}::uuid,'QA other address','{}'::jsonb),
  (${sqlLiteral(blockedClientId)}::uuid,'QA blocked address','{}'::jsonb);
insert into public.admin_profiles (user_id,admin_level,department) values
  (${sqlLiteral(adminId)}::uuid,'support_admin','Profile QA');
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
const blockedClientApi = await signInClient("blockedClient");
const adminApi = await signInClient("admin");

const { data: ownRows, error: ownReadError } = await clientApi
  .from("user_profiles")
  .select("user_id,full_name,email,locale,status")
  .eq("user_id", clientId);
if (ownReadError) throw ownReadError;
assertEqual(ownRows?.length ?? 0, 1, "Client reads own profile");
assertEqual(ownRows?.[0]?.full_name, ORIGINAL_NAME, "Client own profile name");

const { data: foreignRows, error: foreignReadError } = await otherClientApi
  .from("user_profiles")
  .select("user_id")
  .eq("user_id", clientId);
if (foreignReadError) throw foreignReadError;
assertEqual(foreignRows?.length ?? 0, 0, "Other client cannot read profile");
console.log("Client profile RLS own/cross-user read isolation: PASS");

const { error: directUserUpdateError } = await clientApi
  .from("user_profiles")
  .update({ full_name: "Direct update must fail" })
  .eq("user_id", clientId);
if (!directUserUpdateError) throw new Error("Client direct user_profiles UPDATE unexpectedly succeeded");
const { error: directClientUpdateError } = await clientApi
  .from("client_profiles")
  .update({ default_address: "Direct address update must fail" })
  .eq("user_id", clientId);
if (!directClientUpdateError) throw new Error("Client direct client_profiles UPDATE unexpectedly succeeded");
console.log("Client direct profile DML fail-closed: PASS");

const requestId = `profile-rpc-${RUN_SUFFIX}`;
const rpcArgs = {
  p_full_name: "QA Profile Updated",
  p_locale: "kg",
  p_default_address: "QA updated address",
  p_request_id: requestId
};
const { data: updated, error: updateError } = await clientApi.rpc("client_profile_update_atomic", rpcArgs);
if (updateError || updated?.ok !== true || updated?.user_id !== clientId || updated?.locale !== "kg" || updated?.idempotent !== false) {
  throw new Error(`Client profile RPC failed: ${updateError?.message || JSON.stringify(updated)}`);
}
assertEqual(queryDbScalar(`select full_name from public.user_profiles where user_id=${sqlLiteral(clientId)}::uuid`), "QA Profile Updated", "Profile RPC full_name");
assertEqual(queryDbScalar(`select locale from public.user_profiles where user_id=${sqlLiteral(clientId)}::uuid`), "kg", "Profile RPC locale");
assertEqual(queryDbScalar(`select default_address from public.client_profiles where user_id=${sqlLiteral(clientId)}::uuid`), "QA updated address", "Profile RPC address");
assertEqual(queryDbScalar(`select email from public.user_profiles where user_id=${sqlLiteral(clientId)}::uuid`), specs.client.email, "Profile RPC preserves email");
assertEqual(queryDbScalar(`select phone from public.user_profiles where user_id=${sqlLiteral(clientId)}::uuid`), ORIGINAL_PHONE, "Profile RPC preserves phone");
assertEqual(queryDbScalar(`select status from public.user_profiles where user_id=${sqlLiteral(clientId)}::uuid`), "active", "Profile RPC preserves status");
assertEqual(queryDbScalar(`select metadata ->> 'immutable' from public.user_profiles where user_id=${sqlLiteral(clientId)}::uuid`), "client-profile-qa", "Profile RPC preserves user metadata");
assertEqual(queryDbScalar(`select metadata ->> 'immutable' from public.client_profiles where user_id=${sqlLiteral(clientId)}::uuid`), "client-profile-qa", "Profile RPC preserves client metadata");
assertEqual(queryDbScalar(`select count(*) from public.audit_logs where actor_id=${sqlLiteral(clientId)}::uuid and action='client_profile_updated' and request_id=${sqlLiteral(requestId)}`), "1", "Profile audit count");
assertEqual(queryDbScalar(`select case when (coalesce(before,'{}'::jsonb)::text || coalesce(after,'{}'::jsonb)::text) like '%QA Profile Updated%' or (coalesce(before,'{}'::jsonb)::text || coalesce(after,'{}'::jsonb)::text) like '%QA updated address%' then 'leak' else 'safe' end from public.audit_logs where actor_id=${sqlLiteral(clientId)}::uuid and action='client_profile_updated' and request_id=${sqlLiteral(requestId)} limit 1`), "safe", "Profile audit PII redaction");
console.log("Client profile RPC allowlist + PII-safe audit: PASS");

const { data: replay, error: replayError } = await clientApi.rpc("client_profile_update_atomic", rpcArgs);
if (replayError || replay?.ok !== true || replay?.user_id !== clientId || replay?.idempotent !== true) {
  throw new Error(`Profile RPC replay was not idempotent: ${replayError?.message || JSON.stringify(replay)}`);
}
assertEqual(queryDbScalar(`select count(*) from public.audit_logs where actor_id=${sqlLiteral(clientId)}::uuid and action='client_profile_updated' and request_id=${sqlLiteral(requestId)}`), "1", "Profile replay audit count");
console.log("Client profile idempotent replay: PASS");

const { error: payloadConflict } = await clientApi.rpc("client_profile_update_atomic", {
  ...rpcArgs,
  p_full_name: "Changed payload must fail"
});
if (!payloadConflict) throw new Error("Changed profile payload unexpectedly reused request id");
console.log("Client profile request-id payload conflict: PASS");

const { error: invalidLocaleError } = await clientApi.rpc("client_profile_update_atomic", {
  p_full_name: "Invalid Locale",
  p_locale: "xx",
  p_default_address: "Address",
  p_request_id: `profile-invalid-${RUN_SUFFIX}`
});
if (!invalidLocaleError) throw new Error("Invalid profile locale unexpectedly succeeded");

const { error: adminUpdateError } = await adminApi.rpc("client_profile_update_atomic", {
  p_full_name: "Admin cannot use client RPC",
  p_locale: "ru",
  p_default_address: "Address",
  p_request_id: `profile-admin-${RUN_SUFFIX}`
});
if (!adminUpdateError) throw new Error("Support admin unexpectedly used client profile RPC");

const { error: blockedUpdateError } = await blockedClientApi.rpc("client_profile_update_atomic", {
  p_full_name: "Blocked cannot update",
  p_locale: "ru",
  p_default_address: "Address",
  p_request_id: `profile-blocked-${RUN_SUFFIX}`
});
if (!blockedUpdateError) throw new Error("Blocked client unexpectedly updated profile");
console.log("Client profile role/status/validation guards: PASS");

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
    throw new Error(`Profile login unavailable for ${key}: url=${page.url()} http=${response?.status() ?? "unknown"} body=${JSON.stringify(body)} cause=${error?.message || error}`);
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
await loginBrowser(clientPage, "client", "/client/profile");
await clientPage.getByText("Личные данные", { exact: true }).waitFor({ timeout: 10000 });
assertEqual(await clientPage.locator('input[name="fullName"]').inputValue(), "QA Profile Updated", "Browser profile prefilled name");
assertEqual(await clientPage.locator('select[name="locale"]').inputValue(), "kg", "Browser profile prefilled locale");
assertEqual(await clientPage.locator('textarea[name="defaultAddress"]').inputValue(), "QA updated address", "Browser profile prefilled address");
assertEqual(await clientPage.locator('input[type="email"]').inputValue(), specs.client.email, "Browser profile read-only email");
if (!(await clientPage.locator('input[type="email"]').isDisabled())) throw new Error("Browser profile email is not disabled");

await clientPage.locator('input[name="fullName"]').fill("Browser Profile Updated");
await clientPage.locator('select[name="locale"]').selectOption("en");
await clientPage.locator('textarea[name="defaultAddress"]').fill("Browser updated address");
await Promise.all([
  clientPage.waitForURL((url) => url.pathname === "/client/profile" && url.searchParams.get("profile") === "updated", { timeout: 15000 }),
  clientPage.getByRole("button", { name: "Сохранить профиль" }).click()
]);
await clientPage.getByRole("status").waitFor({ timeout: 10000 });
assertEqual(await clientPage.locator('input[name="fullName"]').inputValue(), "Browser Profile Updated", "Browser profile updated name");
assertEqual(await clientPage.locator('select[name="locale"]').inputValue(), "en", "Browser profile updated locale");
assertEqual(await clientPage.locator('textarea[name="defaultAddress"]').inputValue(), "Browser updated address", "Browser profile updated address");
assertEqual(queryDbScalar(`select full_name from public.user_profiles where user_id=${sqlLiteral(clientId)}::uuid`), "Browser Profile Updated", "Browser server action DB full_name");
assertEqual(queryDbScalar(`select locale from public.user_profiles where user_id=${sqlLiteral(clientId)}::uuid`), "en", "Browser server action DB locale");
assertEqual(queryDbScalar(`select default_address from public.client_profiles where user_id=${sqlLiteral(clientId)}::uuid`), "Browser updated address", "Browser server action DB address");
assertEqual(queryDbScalar(`select count(*) from public.audit_logs where actor_id=${sqlLiteral(clientId)}::uuid and action='client_profile_updated'`), "2", "Browser profile creates second audit event");
console.log("Client browser profile -> server action -> RPC -> DB -> reread: PASS");

await clientApi.auth.signOut({ scope: "local" });
await otherClientApi.auth.signOut({ scope: "local" });
await blockedClientApi.auth.signOut({ scope: "local" });
await adminApi.auth.signOut({ scope: "local" });
await clientContext.close();
await browser.close();

console.log("KÖL local Client Profile browser/RPC/DB runtime: PASS");